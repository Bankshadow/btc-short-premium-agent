import { getBinanceStatus, getPositions } from "@/lib/exchange/binance/binance-futures-testnet";
import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { reconcileBinancePositions } from "@/lib/exchange/binance/binance-position-monitor";
import { reconcileBinanceJournalStatuses } from "@/lib/exchange/binance/binance-journal-reconcile";
import type { BinancePosition, BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import { loadCentralAnalysisBundle } from "@/lib/analysis-engine/analysis-orchestrator";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { filterProductionEntries, filterProductionOrders } from "@/lib/journal/production-filter";
import { listWarehouseRows } from "@/lib/db/repositories/warehouse-repository";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { buildGoalTradeListServer } from "@/lib/goal-engine/build-server-context";
import { loadLearningRecordsServer } from "@/lib/testnet-monitor/learning-records-server";
import { loadMonitorJournalEvents } from "@/lib/testnet-monitor/monitor-journal-server";
import { isClosedJournalEntry } from "@/lib/learning-queue/build-learning-progress";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type {
  AnalysisContextConsistencyLink,
  ConsistencyAutoFixId,
  ConsistencyIssue,
  EngineConsistencySnapshot,
} from "./types";
import {
  ENGINE_CONSISTENCY_LABEL,
  ENGINE_CONSISTENCY_MVP,
} from "./types";
import { resolveConsistencyStatus } from "./resolve-consistency-status";

const PNL_DRIFT_USD = 1.0;

function issue(
  partial: Omit<ConsistencyIssue, "id"> & { id?: string },
): ConsistencyIssue {
  return {
    id: partial.id ?? `con-${partial.kind}-${partial.relatedId ?? Date.now()}`,
    ...partial,
  };
}

export async function buildEngineConsistencySnapshot(): Promise<EngineConsistencySnapshot> {
  const generatedAt = new Date().toISOString();
  const issues: ConsistencyIssue[] = [];
  const autoFixActions = new Set<ConsistencyAutoFixId>();

  const [
    entriesRaw,
    paperRows,
    binanceJournal,
    learningRecords,
    monitorEvents,
    missionResult,
    centralBundle,
    trades,
    binanceStatus,
    positionsRaw,
  ] = await Promise.all([
    loadServerAnalysisJournal().catch(() => []),
    listWarehouseRows("paper_trades", 500).catch(() => [] as PaperOrder[]),
    loadServerBinanceTestnetJournal().catch(() => []),
    loadLearningRecordsServer().catch(() => []),
    loadMonitorJournalEvents().catch(() => []),
    buildMissionFlowServerSnapshot({ fresh: true }).catch(() => null),
    loadCentralAnalysisBundle(),
    buildGoalTradeListServer().catch(() => []),
    getBinanceStatus().catch(() => null),
    getPositions().catch(() => [] as BinancePosition[]),
  ]);

  const entries = filterProductionEntries(entriesRaw);
  const orders = filterProductionOrders(
    Array.isArray(paperRows) ? (paperRows as PaperOrder[]) : [],
  );
  const mission = missionResult?.snapshot ?? null;
  const { state } = centralBundle;
  const connected = Boolean(binanceStatus?.connected);
  const positions = connected ? positionsRaw : [];

  const reconciledJournal = reconcileBinanceJournalStatuses(binanceJournal, positions);
  const positionReport = reconcileBinancePositions({
    positions,
    journal: reconciledJournal,
  });

  if (JSON.stringify(reconciledJournal) !== JSON.stringify(binanceJournal)) {
    autoFixActions.add("journal_reconcile");
  }

  const learningByTradeId = new Set(
    learningRecords.map((r) => r.tradeId ?? r.closedTradeId),
  );
  const decisionIdsWithMonitorEvent = new Set(
    monitorEvents.filter((e) => e.decisionLogId).map((e) => e.decisionLogId as string),
  );

  // Trade without decisionLogId
  for (const trade of trades) {
    if (trade.environment === "TESTNET" || trade.environment === "PAPER") {
      if (!trade.decisionLogId) {
        issues.push(
          issue({
            kind: "trade_without_decision_log_id",
            severity: "WARNING",
            message: `${trade.environment} ${trade.symbol} trade missing decisionLogId.`,
            source: "Trade Journal",
            relatedId: trade.id,
            autoFixId: null,
            requiredManualAction: "Link trade to decision log in testnet monitor or ledger.",
          }),
        );
      }
    }
  }

  for (const j of binanceJournal) {
    if (!j.decisionLogId && ["FILLED", "CLOSED", "CLOSING"].includes(j.status)) {
      issues.push(
        issue({
          kind: "trade_without_decision_log_id",
          severity: "WARNING",
          message: `Binance journal ${j.symbol} ${j.status} missing decisionLogId.`,
          source: "Binance Testnet Journal",
          relatedId: j.binanceTestnetTradeId,
          autoFixId: null,
          requiredManualAction: "Attach decision log when reviewing trade in Raw Ledger.",
        }),
      );
    }
  }

  // CLOSED trade without PnL
  for (const j of binanceJournal) {
    if (j.status === "CLOSED" && (j.realizedPnl == null || !Number.isFinite(j.realizedPnl))) {
      issues.push(
        issue({
          kind: "closed_trade_without_pnl",
          severity: "WARNING",
          message: `CLOSED journal ${j.symbol} missing realized PnL.`,
          source: "Binance Testnet Journal",
          relatedId: j.binanceTestnetTradeId,
          autoFixId: "journal_reconcile",
          requiredManualAction: null,
        }),
      );
      autoFixActions.add("journal_reconcile");
    }
  }

  for (const trade of trades.filter((t) => t.result !== "OPEN")) {
    if (Math.abs(trade.pnlUsd) < 0.0001 && trade.environment === "TESTNET") {
      issues.push(
        issue({
          kind: "closed_trade_without_pnl",
          severity: "WARNING",
          message: `Closed testnet trade ${trade.symbol} shows zero PnL.`,
          source: "Trade Journal",
          relatedId: trade.id,
          autoFixId: "journal_reconcile",
          requiredManualAction: null,
        }),
      );
    }
  }

  // PnL not reflected on Dashboard (mission snapshot vs trade list)
  const closedPnlSum = trades
    .filter((t) => t.result !== "OPEN" && t.environment !== "LIVE")
    .reduce((s, t) => s + t.pnlUsd, 0);
  const missionNetPnl = mission?.netPnl ?? 0;
  if (
    mission &&
    trades.length > 0 &&
    Math.abs(missionNetPnl - closedPnlSum) > PNL_DRIFT_USD
  ) {
    issues.push(
      issue({
        kind: "pnl_not_on_dashboard",
        severity: "WARNING",
        message: `Mission net PnL ${missionNetPnl.toFixed(2)} differs from trade sum ${closedPnlSum.toFixed(2)}.`,
        source: "Mission Snapshot vs Trade Journal",
        relatedId: null,
        autoFixId: "mission_snapshot_refresh",
        requiredManualAction: null,
      }),
    );
    autoFixActions.add("mission_snapshot_refresh");
  }

  // Binance position not in local journal
  if (connected) {
    for (const mismatch of positionReport.mismatches) {
      if (mismatch.includes("no matching journal entry")) {
        const symbol = mismatch.match(/on (\w+)/)?.[1] ?? null;
        issues.push(
          issue({
            kind: "binance_position_not_in_journal",
            severity: "BLOCKED",
            message: mismatch,
            source: "Binance Testnet Positions",
            relatedId: symbol,
            autoFixId: "journal_backfill",
            requiredManualAction:
              "Review exchange position — backfill records ledger only; never auto-opens trades.",
          }),
        );
        autoFixActions.add("journal_backfill");
      }
    }
  }

  // Local open trade but no Binance position
  if (connected) {
    for (const mismatch of positionReport.mismatches) {
      if (mismatch.includes("FILLED but no exchange position")) {
        issues.push(
          issue({
            kind: "local_open_no_binance_position",
            severity: "BLOCKED",
            message: mismatch,
            source: "Trade Journal vs Binance",
            relatedId: null,
            autoFixId: "journal_reconcile",
            requiredManualAction:
              "Confirm whether position was closed on exchange or journal is stale.",
          }),
        );
        autoFixActions.add("journal_reconcile");
      }
    }

    const openTrades = trades.filter(
      (t) => t.result === "OPEN" && t.environment === "TESTNET",
    );
    for (const trade of openTrades) {
      const hasPosition = positions.some(
        (p) => p.symbol === trade.symbol && Math.abs(Number(p.positionAmt)) > 0,
      );
      if (!hasPosition) {
        issues.push(
          issue({
            kind: "local_open_no_binance_position",
            severity: "BLOCKED",
            message: `Local OPEN testnet ${trade.symbol} but no Binance position.`,
            source: "Trade Journal",
            relatedId: trade.id,
            autoFixId: "journal_reconcile",
            requiredManualAction: "Refresh testnet monitor or close stale local OPEN row.",
          }),
        );
      }
    }
  }

  // Decision exists but no journal event
  for (const entry of entries.slice(0, 20)) {
    if (!decisionIdsWithMonitorEvent.has(entry.id)) {
      issues.push(
        issue({
          kind: "decision_without_journal_event",
          severity: "WARNING",
          message: `Decision ${entry.id.slice(0, 12)}… has no monitor journal event.`,
          source: "Decision Log",
          relatedId: entry.id,
          autoFixId: null,
          requiredManualAction:
            "Run analysis cycle or check monitor journal — may be pre-monitor legacy entry.",
        }),
      );
    }
  }

  // Learning record missing after CLOSED trade
  for (const j of binanceJournal.filter(isClosedJournalEntry)) {
    const tradeId = j.binanceTestnetTradeId;
    if (!learningByTradeId.has(tradeId)) {
      issues.push(
        issue({
          kind: "learning_record_missing_after_closed",
          severity: "WARNING",
          message: `CLOSED ${j.symbol} missing learning record.`,
          source: "Learning Records",
          relatedId: tradeId,
          autoFixId: "learning_sync",
          requiredManualAction: null,
        }),
      );
      autoFixActions.add("learning_sync");
    }
  }

  // Central vs mission decision drift
  const journalHeadId = entries[0]?.id ?? null;
  const stateDecisionId = state.latestDecisionLogId;
  const missionDecisionId = mission?.latestDecisionLogId ?? null;

  if (stateDecisionId && journalHeadId && stateDecisionId !== journalHeadId) {
    issues.push(
      issue({
        kind: "central_state_decision_drift",
        severity: "WARNING",
        message: "Central analysis state decisionLogId differs from decision log head.",
        source: "Analysis Engine",
        relatedId: stateDecisionId,
        autoFixId: "mission_snapshot_refresh",
        requiredManualAction: null,
      }),
    );
    autoFixActions.add("mission_snapshot_refresh");
  }

  if (missionDecisionId && journalHeadId && missionDecisionId !== journalHeadId) {
    issues.push(
      issue({
        kind: "analysis_mission_decision_drift",
        severity: "WARNING",
        message: "Mission snapshot latestDecisionLogId differs from decision log head.",
        source: "Mission Snapshot",
        relatedId: missionDecisionId,
        autoFixId: "mission_snapshot_refresh",
        requiredManualAction: null,
      }),
    );
    autoFixActions.add("mission_snapshot_refresh");
  }

  const positionStateUncertain = issues.some(
    (i) =>
      i.severity === "BLOCKED" &&
      (i.kind === "binance_position_not_in_journal" ||
        i.kind === "local_open_no_binance_position"),
  );

  const { consistencyStatus, consistencyLabel, blocksNewTrades } = resolveConsistencyStatus(
    issues,
    positionStateUncertain,
  );

  const requiredManualActions = [
    ...new Set(
      issues
        .map((i) => i.requiredManualAction)
        .filter((m): m is string => Boolean(m)),
    ),
  ];

  return {
    mvp: ENGINE_CONSISTENCY_MVP,
    label: ENGINE_CONSISTENCY_LABEL,
    consistencyStatus,
    consistencyLabel,
    positionStateUncertain,
    blocksNewTrades,
    issues,
    autoFixAvailable: autoFixActions.size > 0,
    autoFixActions: [...autoFixActions],
    requiredManualActions,
    generatedAt,
    storeSummary: {
      decisionLogCount: entries.length,
      tradeJournalCount: binanceJournal.length,
      monitorEventCount: monitorEvents.length,
      learningRecordCount: learningRecords.length,
      binanceOpenPositions: positionReport.openCount,
      localOpenTrades: trades.filter((t) => t.result === "OPEN").length,
      missionDecisionLogId: missionDecisionId,
      centralDecisionLogId: stateDecisionId,
      missionNetPnl,
      dashboardNetPnl: closedPnlSum,
    },
  };
}

export function toAnalysisContextConsistencyLink(
  snapshot: EngineConsistencySnapshot,
): AnalysisContextConsistencyLink {
  return {
    status: snapshot.consistencyStatus,
    positionStateUncertain: snapshot.positionStateUncertain,
    blocksNewTrades: snapshot.blocksNewTrades,
    issueCount: snapshot.issues.length,
    topIssue: snapshot.issues[0]?.message ?? null,
  };
}
