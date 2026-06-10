import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { loadAnomalyIncidents } from "@/lib/anomaly-detection/store";
import {
  filterTradeBlockingCriticalIncidents,
  isIncidentOpen,
} from "@/lib/anomaly-detection/incident-policy";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor/build-testnet-monitor-snapshot";
import { loadServerUnifiedPortfolio } from "@/lib/portfolio/unified-paper-server-store";
import { loadServerPendingOperatorActions } from "@/lib/automation-control-plane/state-store";
import { buildServerReadinessContext } from "@/lib/live-readiness/server-context";
import { buildObservabilitySnapshot } from "@/lib/observability/build-snapshot";
import { evaluateRealTimeRisk } from "@/lib/real-time-risk/evaluate-realtime-risk";
import { evaluateServerBackboneHealth } from "@/lib/background-worker/server-backbone";
import { buildExecutionQualitySummary } from "@/lib/execution-quality";
import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import {
  buildStrategyHealthSignal,
  buildStrategyHealthSummary,
} from "@/lib/strategy-health";
import { listWarehouseRows } from "@/lib/db/repositories/warehouse-repository";
import { loadRiskReplayReviewHistory } from "./risk-replay-review-store";
import type { LiveEvidenceBuildInput } from "./types";

function runtimeDoubleConfirmRequired(): boolean {
  const raw = process.env.LIVE_REQUIRE_DOUBLE_CONFIRM?.trim().toLowerCase();
  return raw !== "false";
}

function liveEndpointLockDetail(): { lockedCorrectly: boolean; detail: string } {
  const enabledRaw = process.env.LIVE_EXECUTION_ENABLED?.trim().toLowerCase();
  const liveEnabled = enabledRaw === "true" || enabledRaw === "1" || enabledRaw === "yes";
  const doubleConfirm = runtimeDoubleConfirmRequired();
  const lockedCorrectly = !liveEnabled || doubleConfirm;
  return {
    lockedCorrectly,
    detail: lockedCorrectly
      ? "Live endpoint lock looks correct (disabled or double-confirm enforced)."
      : "LIVE_EXECUTION_ENABLED=true while LIVE_REQUIRE_DOUBLE_CONFIRM is disabled.",
  };
}

export async function buildServerLiveEvidenceInput(): Promise<LiveEvidenceBuildInput> {
  const [
    entries,
    testnetSnapshot,
    portfolio,
    incidents,
    operatorActions,
    serverContext,
    observability,
    backbone,
    testnetJournal,
    paperRows,
    liveRows,
    riskReplayHistory,
  ] = await Promise.all([
    loadServerAnalysisJournal().catch(() => []),
    buildTestnetMonitorSnapshot().catch(() => null),
    loadServerUnifiedPortfolio().catch(() => null),
    loadAnomalyIncidents().catch(() => []),
    loadServerPendingOperatorActions().catch(() => []),
    buildServerReadinessContext(),
    buildObservabilitySnapshot("server-default", {
      promoteIncidents: false,
      useCache: false,
    }).catch(() => null),
    evaluateServerBackboneHealth().catch(() => null),
    loadServerBinanceTestnetJournal().catch(() => []),
    listWarehouseRows("paper_trades", 500).catch(() => []),
    listWarehouseRows("live_trades", 300).catch(() => []),
    loadRiskReplayReviewHistory().catch(() => []),
  ]);

  const paperOrders = paperRows
    .map((r) => r.payload as unknown)
    .filter((p): p is import("@/lib/paper/paper-order-types").PaperOrder => {
      if (!p || typeof p !== "object") return false;
      const rec = p as Record<string, unknown>;
      return typeof rec.id === "string" && typeof rec.decisionLogId === "string";
    });

  const liveTrades = liveRows
    .map((r) => r.payload as unknown)
    .filter((p): p is import("@/lib/live-pilot/types").LiveTradeJournalEntry => {
      if (!p || typeof p !== "object") return false;
      const rec = p as Record<string, unknown>;
      return typeof rec.liveTradeId === "string" && typeof rec.status === "string";
    });

  const strategyHealth = buildStrategyHealthSignal(
    buildStrategyHealthSummary({
      entries,
      orders: paperOrders,
      unifiedPortfolio: portfolio,
      testnetSnapshot,
      liveTrades,
    }),
  );

  const riskReport = evaluateRealTimeRisk({
    entries,
    orders: paperOrders,
    liveTrades,
  });

  const paperSample = strategyHealth.totalStrategies > 0
    ? paperOrders.filter((o) => o.status === "CLOSED").length
    : 0;
  const paperWinCount = paperOrders.filter(
    (o) => o.status === "CLOSED" && (o.realizedPnlPct ?? 0) > 0,
  ).length;
  const paperClosed = paperOrders.filter((o) => o.status === "CLOSED");
  const paperTotalPnl = Number(
    paperClosed.reduce((s, o) => s + (o.realizedPnlPct ?? 0), 0).toFixed(2),
  );
  const paperAvgR = paperClosed.length > 0 ? Number((paperTotalPnl / paperClosed.length).toFixed(2)) : 0;
  const paperWinRate =
    paperClosed.length > 0 ? Number(((paperWinCount / paperClosed.length) * 100).toFixed(1)) : 0;

  const openCriticalIncidents = filterTradeBlockingCriticalIncidents(incidents).length;
  const openWarningIncidents = incidents.filter(
    (i) => i.severity === "WARNING" && isIncidentOpen(i.status),
  ).length;

  const failedLiveTrades = liveTrades.filter((t) => t.status === "FAILED").length;
  const executionQualityFromJournal = buildExecutionQualitySummary({
    testnetJournal,
    liveTrades,
  });
  const executionCritical = incidents.filter(
    (i) =>
      (i.anomalyType === "close_reduce_only_failed" || i.anomalyType === "duplicate_order") &&
      isIncidentOpen(i.status) &&
      filterTradeBlockingCriticalIncidents([i]).length > 0,
  ).length;
  const executionWarning = incidents.filter(
    (i) =>
      (i.anomalyType === "close_reduce_only_failed" || i.anomalyType === "duplicate_order") &&
      i.severity === "WARNING" &&
      isIncidentOpen(i.status),
  ).length;

  const pendingApprovals = operatorActions.filter(
    (a) => a.status === "OPEN" && a.requiresHumanApproval,
  ).length;

  const lastRiskReplayReview = riskReplayHistory[0]?.reviewedAt ?? null;
  const endpointLock = liveEndpointLockDetail();

  return {
    generatedAt: new Date().toISOString(),
    paper: {
      sampleSize: paperSample,
      winRate: paperWinRate,
      averageR: paperAvgR,
      totalPnl: paperTotalPnl,
    },
    testnet: {
      closedTrades: testnetSnapshot?.closedTrades.length ?? 0,
      learningRecords: testnetSnapshot?.learningRecords.length ?? 0,
      learnedRecords:
        testnetSnapshot?.learningRecords.filter((r) => r.status === "LEARNED").length ?? 0,
      winRate: testnetSnapshot?.summary.winRate ?? 0,
      mismatches: testnetSnapshot?.mismatches.length ?? 0,
    },
    execution: {
      failedLiveTrades,
      criticalExecutionIncidents: executionCritical,
      warningExecutionIncidents: executionWarning,
      averageSlippageBps: executionQualityFromJournal.averageSlippageBps,
      rejectionRatePct: executionQualityFromJournal.rejectionRatePct,
      failedCloseRatePct: executionQualityFromJournal.failedCloseRatePct,
      averageLatencyMs: executionQualityFromJournal.averageLatencyMs,
      duplicateSubmissionCount: executionQualityFromJournal.duplicateSubmissionCount,
      retryCountTotal: executionQualityFromJournal.retryCountTotal,
      gateStatus: executionQualityFromJournal.liveQualityGate.status,
      gateReasons: executionQualityFromJournal.liveQualityGate.reasons,
    },
    riskControl: {
      riskStatus: riskReport.riskStatus,
      blockNewTrades: riskReport.blockNewTrades,
      triggeredLimits: riskReport.triggeredLimits,
      riskReplayReviewedAt: lastRiskReplayReview,
    },
    incidents: {
      openCount: openCriticalIncidents + openWarningIncidents,
      warningOpenCount: openWarningIncidents,
      criticalOpenCount: openCriticalIncidents,
    },
    alerts: {
      anyChannelConfigured: observability?.signals.alerts.anyChannelConfigured ?? false,
      recentDeliveryFailures: observability?.signals.alerts.recentDeliveryFailures ?? 0,
      lastDeliveryAt: observability?.signals.alerts.lastDeliveryAt ?? null,
    },
    ledger: {
      healthy: backbone?.healthy ?? false,
      entryCount: (backbone?.record?.decisions.length ?? 0) + (backbone?.record?.trades.length ?? 0),
      brokenLinks: 0,
      missingHashes: 0,
      orphanTrades: 0,
      issues: backbone?.health?.writeBlockers ?? ["No server backbone health available."],
      lastSyncedAt: backbone?.record?.lastWriteAt ?? null,
    },
    operatorApproval: {
      doubleConfirmRequired: serverContext.liveExecution.requireDoubleConfirm,
      pendingApprovalActions: pendingApprovals,
    },
    strategyHealth: strategyHealth,
    exchange: {
      configured: serverContext.exchangeStatus.configured,
      connected: serverContext.exchangeStatus.connected,
      network: serverContext.exchangeStatus.network,
      error: serverContext.exchangeStatus.error ?? null,
      clockSkewMs: serverContext.exchangeStatus.clockSkewMs,
    },
    endpointLock,
  };
}
