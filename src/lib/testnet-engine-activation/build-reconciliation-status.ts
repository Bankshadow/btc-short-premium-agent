import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { getPositions } from "@/lib/exchange/binance/binance-futures-testnet";
import { probeBinanceStatus } from "./activation-probes";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { filterProductionEntries } from "@/lib/journal/production-filter";
import { loadLearningRecordsServer } from "@/lib/testnet-monitor/learning-records-server";
import { loadMonitorJournalEvents } from "@/lib/testnet-monitor/monitor-journal-server";
import { buildClosedTradesFromJournal } from "@/lib/testnet-monitor/build-testnet-monitor-snapshot";
import { assembleEngineConsistencySnapshot } from "@/lib/engine-consistency/assemble-engine-consistency-snapshot";
import { readTestnetMonitorSnapshotCache } from "@/lib/testnet-monitor/snapshot-cache";
import {
  TESTNET_ENGINE_ACTIVATION_MVP,
  type ReconciliationActivationStatus,
  type ReconciliationStatusResponse,
} from "./types";

function countByKind(
  issues: Array<{ kind: string }>,
  kinds: string[],
): number {
  return issues.filter((i) => kinds.includes(i.kind)).length;
}

/** Lightweight reconciliation status for MVP 95 — uses cache when available. */
export async function buildReconciliationStatus(): Promise<ReconciliationStatusResponse> {
  const updatedAt = new Date().toISOString();
  const cached = readTestnetMonitorSnapshotCache()?.snapshot;

  if (cached) {
    const ec = cached.engineConsistency;
    const issues = ec.issues;
    const hasTrades =
      cached.closedTrades.length > 0 || cached.summary.tradeCount > 0;

    if (!hasTrades && issues.length === 0) {
      return {
        mvp: TESTNET_ENGINE_ACTIVATION_MVP,
        status: "OK",
        message: "OK — no trades to reconcile yet.",
        orphanOpenTrades: 0,
        closedTradeMissingPnl: 0,
        decisionMissingJournal: countByKind(issues, ["decision_without_journal_event"]),
        journalMissingDecision: countByKind(issues, ["trade_without_decision_log_id"]),
        binancePositionMissingLocalTrade: countByKind(issues, [
          "binance_position_not_in_journal",
        ]),
        localOpenTradeMissingBinancePosition: countByKind(issues, [
          "local_open_no_binance_position",
        ]),
        learningMissingForClosedTrade: countByKind(issues, [
          "learning_record_missing_after_closed",
        ]),
        autoFixAvailable: ec.autoFixAvailable,
        requiredManualAction: ec.requiredManualActions[0] ?? null,
        updatedAt,
        liveTradingLocked: true,
      };
    }

    const status: ReconciliationActivationStatus =
      ec.consistencyStatus === "BLOCKED"
        ? "BLOCKED"
        : ec.consistencyStatus === "WARNING"
          ? "WARNING"
          : "OK";

    return {
      mvp: TESTNET_ENGINE_ACTIVATION_MVP,
      status,
      message:
        status === "OK"
          ? "All stores consistent."
          : ec.issues[0]?.message ?? ec.consistencyLabel,
      orphanOpenTrades: 0,
      closedTradeMissingPnl: countByKind(issues, ["closed_trade_without_pnl"]),
      decisionMissingJournal: countByKind(issues, ["decision_without_journal_event"]),
      journalMissingDecision: countByKind(issues, ["trade_without_decision_log_id"]),
      binancePositionMissingLocalTrade: countByKind(issues, [
        "binance_position_not_in_journal",
      ]),
      localOpenTradeMissingBinancePosition: countByKind(issues, [
        "local_open_no_binance_position",
      ]),
      learningMissingForClosedTrade: countByKind(issues, [
        "learning_record_missing_after_closed",
      ]),
      autoFixAvailable: ec.autoFixAvailable,
      requiredManualAction: ec.requiredManualActions[0] ?? null,
      updatedAt,
      liveTradingLocked: true,
    };
  }

  const [journal, entriesRaw, learningRecords, monitorEvents, binanceStatus] =
    await Promise.all([
      loadServerBinanceTestnetJournal().catch(() => []),
      loadServerAnalysisJournal().catch(() => []),
      loadLearningRecordsServer().catch(() => []),
      loadMonitorJournalEvents().catch(() => []),
      probeBinanceStatus(),
    ]);

  const decisions = filterProductionEntries(entriesRaw);
  const closedTrades = buildClosedTradesFromJournal(journal);
  const hasOpenJournal = journal.some((j) => j.status !== "CLOSED");
  const connected = Boolean(binanceStatus?.connected);
  const positions =
    closedTrades.length > 0 || hasOpenJournal
      ? await getPositions().catch(() => [])
      : [];
  const mismatches: string[] = [];

  const ec = assembleEngineConsistencySnapshot({
    connected,
    positions,
    binanceJournal: journal,
    positionMismatches: mismatches,
    learningRecords,
    monitorEvents,
    decisions,
    dashboardNetPnl: closedTrades.reduce((s, t) => s + t.netPnl, 0),
  });

  const issues = ec.issues;
  const hasTrades = closedTrades.length > 0;

  if (!hasTrades && issues.length === 0) {
    return {
      mvp: TESTNET_ENGINE_ACTIVATION_MVP,
      status: "OK",
      message: "OK — no trades to reconcile yet.",
      orphanOpenTrades: 0,
      closedTradeMissingPnl: 0,
      decisionMissingJournal: 0,
      journalMissingDecision: 0,
      binancePositionMissingLocalTrade: 0,
      localOpenTradeMissingBinancePosition: 0,
      learningMissingForClosedTrade: 0,
      autoFixAvailable: false,
      requiredManualAction: null,
      updatedAt,
      liveTradingLocked: true,
    };
  }

  const status: ReconciliationActivationStatus =
    ec.consistencyStatus === "BLOCKED"
      ? "BLOCKED"
      : ec.consistencyStatus === "WARNING"
        ? "WARNING"
        : "OK";

  return {
    mvp: TESTNET_ENGINE_ACTIVATION_MVP,
    status,
    message:
      status === "OK" ? "All stores consistent." : issues[0]?.message ?? ec.consistencyLabel,
    orphanOpenTrades: 0,
    closedTradeMissingPnl: countByKind(issues, ["closed_trade_without_pnl"]),
    decisionMissingJournal: countByKind(issues, ["decision_without_journal_event"]),
    journalMissingDecision: countByKind(issues, ["trade_without_decision_log_id"]),
    binancePositionMissingLocalTrade: countByKind(issues, ["binance_position_not_in_journal"]),
    localOpenTradeMissingBinancePosition: countByKind(issues, [
      "local_open_no_binance_position",
    ]),
    learningMissingForClosedTrade: countByKind(issues, [
      "learning_record_missing_after_closed",
    ]),
    autoFixAvailable: ec.autoFixAvailable,
    requiredManualAction: ec.requiredManualActions[0] ?? null,
    updatedAt,
    liveTradingLocked: true,
  };
}
