import { isClosedJournalEntry } from "@/lib/learning-queue/build-learning-progress";
import type { BinancePosition, BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TestnetLearningRecord } from "@/lib/testnet-monitor/types";
import type { TestnetMonitorJournalEvent } from "@/lib/testnet-monitor/types";
import {
  ENGINE_CONSISTENCY_LABEL,
  ENGINE_CONSISTENCY_MVP,
  type ConsistencyAutoFixId,
  type ConsistencyIssue,
  type EngineConsistencySnapshot,
} from "./types";
import { resolveConsistencyStatus } from "./resolve-consistency-status";

function issue(
  partial: Omit<ConsistencyIssue, "id"> & { id?: string },
): ConsistencyIssue {
  return {
    id: partial.id ?? `con-${partial.kind}-${partial.relatedId ?? Date.now()}`,
    ...partial,
  };
}

export interface AssembleEngineConsistencyInput {
  connected: boolean;
  positions: BinancePosition[];
  binanceJournal: BinanceTestnetJournalEntry[];
  positionMismatches: string[];
  learningRecords: TestnetLearningRecord[];
  monitorEvents: TestnetMonitorJournalEvent[];
  decisions: DecisionLogEntry[];
  dashboardNetPnl: number;
  centralDecisionLogId?: string | null;
  missionDecisionLogId?: string | null;
  missionNetPnl?: number | null;
}

/** Pure assembler — safe to call from testnet monitor build (no mission-flow cycle). */
export function assembleEngineConsistencySnapshot(
  input: AssembleEngineConsistencyInput,
): EngineConsistencySnapshot {
  const generatedAt = new Date().toISOString();
  const issues: ConsistencyIssue[] = [];
  const autoFixActions = new Set<ConsistencyAutoFixId>();

  const learningByTradeId = new Set(
    input.learningRecords.map((r) => r.tradeId ?? r.closedTradeId),
  );
  const decisionIdsWithMonitorEvent = new Set(
    input.monitorEvents
      .filter((e) => e.decisionLogId)
      .map((e) => e.decisionLogId as string),
  );

  for (const j of input.binanceJournal) {
    if (!j.decisionLogId && ["FILLED", "CLOSED", "CLOSING"].includes(j.status)) {
      issues.push(
        issue({
          kind: "trade_without_decision_log_id",
          severity: "WARNING",
          message: `Binance journal ${j.symbol} ${j.status} missing decisionLogId.`,
          source: "Binance Testnet Journal",
          relatedId: j.binanceTestnetTradeId,
          autoFixId: "decision_log_backfill",
          requiredManualAction: null,
        }),
      );
      autoFixActions.add("decision_log_backfill");
    }
  }

  for (const j of input.binanceJournal) {
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

  const missionNetPnl = input.missionNetPnl ?? null;
  if (
    missionNetPnl != null &&
    Math.abs(missionNetPnl - input.dashboardNetPnl) > 1.0
  ) {
    issues.push(
      issue({
        kind: "pnl_not_on_dashboard",
        severity: "WARNING",
        message: `Mission net PnL ${missionNetPnl.toFixed(2)} differs from trade sum ${input.dashboardNetPnl.toFixed(2)}.`,
        source: "Mission Snapshot vs Trade Journal",
        relatedId: null,
        autoFixId: "mission_snapshot_refresh",
        requiredManualAction: null,
      }),
    );
    autoFixActions.add("mission_snapshot_refresh");
  }

  if (input.connected) {
    for (const mismatch of input.positionMismatches) {
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

  if (input.connected) {
    for (const mismatch of input.positionMismatches) {
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

    const localOpen = input.binanceJournal.filter(
      (j) => j.status === "FILLED" || j.status === "CLOSING",
    );
    for (const j of localOpen) {
      const hasPosition = input.positions.some(
        (p) => p.symbol === j.symbol && Math.abs(Number(p.positionAmt)) > 0,
      );
      if (!hasPosition) {
        issues.push(
          issue({
            kind: "local_open_no_binance_position",
            severity: "BLOCKED",
            message: `Local OPEN testnet ${j.symbol} but no Binance position.`,
            source: "Trade Journal",
            relatedId: j.binanceTestnetTradeId,
            autoFixId: "journal_reconcile",
            requiredManualAction: "Refresh testnet monitor or close stale local OPEN row.",
          }),
        );
      }
    }
  }

  for (const entry of input.decisions.slice(0, 20)) {
    if (!decisionIdsWithMonitorEvent.has(entry.id)) {
      issues.push(
        issue({
          kind: "decision_without_journal_event",
          severity: "WARNING",
          message: `Decision ${entry.id.slice(0, 12)}… has no monitor journal event.`,
          source: "Decision Log",
          relatedId: entry.id,
          autoFixId: "monitor_event_backfill",
          requiredManualAction: null,
        }),
      );
      autoFixActions.add("monitor_event_backfill");
    }
  }

  for (const j of input.binanceJournal.filter(isClosedJournalEntry)) {
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

  const journalHeadId = input.decisions[0]?.id ?? null;
  const stateDecisionId = input.centralDecisionLogId ?? null;
  const missionDecisionId = input.missionDecisionLogId ?? null;

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

  const binanceOpenPositions = input.positions.filter(
    (p) => Math.abs(Number(p.positionAmt)) > 0,
  ).length;
  const localOpenTrades = input.binanceJournal.filter(
    (j) => j.status === "FILLED" || j.status === "CLOSING",
  ).length;

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
      decisionLogCount: input.decisions.length,
      tradeJournalCount: input.binanceJournal.length,
      monitorEventCount: input.monitorEvents.length,
      learningRecordCount: input.learningRecords.length,
      binanceOpenPositions,
      localOpenTrades,
      missionDecisionLogId: missionDecisionId,
      centralDecisionLogId: stateDecisionId,
      missionNetPnl: missionNetPnl ?? 0,
      dashboardNetPnl: input.dashboardNetPnl,
    },
  };
}
