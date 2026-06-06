import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { listWarehouseRows } from "@/lib/db/repositories/warehouse-repository";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor/build-testnet-monitor-snapshot";
import { loadServerUnifiedPortfolio } from "@/lib/portfolio/unified-paper-server-store";
import { getAutomationStatus } from "@/lib/automation-control-plane/scheduler";
import { buildObservabilitySnapshot } from "@/lib/observability/build-snapshot";
import { evaluateRealTimeRisk } from "@/lib/real-time-risk/evaluate-realtime-risk";
import { loadAnomalyIncidents } from "@/lib/anomaly-detection/store";
import {
  buildStrategyHealthSignal,
  buildStrategyHealthSummary,
} from "@/lib/strategy-health";
import { liveExecutionStatus } from "@/lib/exchange/live-execution-gate";
import { filterProductionEntries, filterProductionOrders } from "@/lib/journal/production-filter";
import { buildCoreEngineRegistry } from "@/lib/core-engine-registry";
import type { CoreEngineRegistrySnapshot } from "@/lib/core-engine-registry";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import { buildGoalProgressSnapshot } from "./build-goal-snapshot";
import { buildGoalTradeList, type GoalTradeRow } from "./build-trade-list";
import type { GoalProgressSnapshot } from "./types";

export interface GoalDashboardServerPayload {
  goal: GoalProgressSnapshot;
  engines: CoreEngineRegistrySnapshot;
}

export async function buildGoalDashboardServerPayload(): Promise<GoalDashboardServerPayload> {
  const [
    entriesRaw,
    testnetSnapshot,
    unifiedPortfolio,
    automation,
    observability,
    incidents,
    paperRows,
    liveRows,
  ] = await Promise.all([
    loadServerAnalysisJournal().catch(() => []),
    buildTestnetMonitorSnapshot().catch(() => null),
    loadServerUnifiedPortfolio().catch(() => null),
    getAutomationStatus().catch(() => null),
    buildObservabilitySnapshot("server-default", {
      promoteIncidents: false,
      useCache: true,
    }).catch(() => null),
    loadAnomalyIncidents().catch(() => []),
    listWarehouseRows("paper_trades", 500).catch(() => []),
    listWarehouseRows("live_trades", 300).catch(() => []),
  ]);

  const entries = filterProductionEntries(entriesRaw);

  const ordersRaw = paperRows
    .map((row) => row.payload as unknown)
    .filter((payload): payload is PaperOrder => {
      if (!payload || typeof payload !== "object") return false;
      const rec = payload as Record<string, unknown>;
      return typeof rec.id === "string" && typeof rec.decisionLogId === "string";
    });
  const orders = filterProductionOrders(ordersRaw);

  const liveTrades = liveRows
    .map((row) => row.payload as unknown)
    .filter((payload): payload is LiveTradeJournalEntry => {
      if (!payload || typeof payload !== "object") return false;
      const rec = payload as Record<string, unknown>;
      return typeof rec.liveTradeId === "string" && typeof rec.status === "string";
    });

  const strategyHealth = buildStrategyHealthSummary({
    entries,
    orders,
    unifiedPortfolio,
    testnetSnapshot,
    liveTrades,
  });
  const strategyHealthSignal = buildStrategyHealthSignal(strategyHealth);

  const riskReport = evaluateRealTimeRisk({
    entries,
    orders,
    liveTrades,
    strategyHealthSignal,
  });

  const live = liveExecutionStatus();
  const criticalIncident = incidents.find(
    (i) => i.severity === "CRITICAL" && (i.status === "OPEN" || i.status === "INVESTIGATING"),
  );

  const settings = automation?.state.settings;
  const lastVerdict = entries.find((e) => e.finalVerdict)?.finalVerdict ?? null;

  const blocker =
    criticalIncident?.title ??
    (riskReport.blockNewTrades
      ? riskReport.triggeredLimits[0] ?? "Risk engine paused new trades."
      : null);

  const goal = buildGoalProgressSnapshot({
    entries,
    orders,
    unifiedPortfolio,
    testnetSnapshot,
    liveTrades,
    ai: {
      automationEnabled: settings?.automationEnabled,
      automationPaused: settings?.paused,
      lastRunStatus: automation?.state.lastRun?.status ?? null,
      lastRunAt: automation?.state.lastSuccessfulRunAt ?? null,
      lastVerdict,
      riskBlocked: riskReport.blockNewTrades,
      blockerReason: blocker,
      nextRunAt: automation?.state.nextRunAt ?? null,
    },
    risk: {
      dailyLossStatus: riskReport.blockNewTrades
        ? "Daily loss limit reached — trading paused."
        : "Within safe daily loss limit.",
      liveLocked: !live.enabled,
      blocker,
    },
  });

  const engines = buildCoreEngineRegistry({
    market: {
      lastAnalysisAt: observability?.signals.marketData.lastAnalysisAt ?? null,
      staleWarning: observability?.signals.marketData.staleWarning ?? null,
      btcPrice: observability?.signals.marketData.btcPrice ?? null,
    },
    agents: {
      lastVerdict,
      lastRunAt: automation?.state.lastSuccessfulRunAt ?? null,
      running: automation?.state.lastRun?.status === "RUNNING",
    },
    strategy: {
      pausedCount: strategyHealth.totals.paused,
      reviewRequiredCount: strategyHealth.totals.reviewRequired,
    },
    risk: {
      status: riskReport.riskStatus,
      blockNewTrades: riskReport.blockNewTrades,
      blocker,
    },
    policy: {
      recentBlocks: observability?.signals.policyBlocks1h ?? 0,
    },
    testnetExecution: {
      enabled: Boolean(testnetSnapshot?.connected),
      openPositions: testnetSnapshot?.openPositions.length ?? 0,
      requiresDoubleConfirm: true,
      failedRecently: (testnetSnapshot?.executionQuality?.failedOrderCount ?? 0) > 0,
    },
    positionMonitor: {
      openPositions:
        (testnetSnapshot?.openPositions.length ?? 0) +
        (unifiedPortfolio?.openPositions.length ?? 0),
    },
    pnl: {
      netPnlUsd: goal.equity.netPnl,
    },
    learning: {
      learnedCount:
        testnetSnapshot?.learningRecords.filter((r) => r.status === "LEARNED").length ?? 0,
      pendingReview:
        testnetSnapshot?.learningRecords.filter((r) => r.status === "PENDING_REVIEW").length ?? 0,
    },
    notification: {
      anyChannelConfigured: observability?.signals.alerts.anyChannelConfigured ?? false,
      recentDeliveryFailures: observability?.signals.alerts.recentDeliveryFailures ?? 0,
      lastDeliveryAt: observability?.signals.alerts.lastDeliveryAt ?? null,
    },
  });

  return { goal, engines };
}

export async function buildGoalTradeListServer(): Promise<GoalTradeRow[]> {
  const [entriesRaw, testnetSnapshot, unifiedPortfolio, paperRows, liveRows] =
    await Promise.all([
      loadServerAnalysisJournal().catch(() => []),
      buildTestnetMonitorSnapshot().catch(() => null),
      loadServerUnifiedPortfolio().catch(() => null),
      listWarehouseRows("paper_trades", 500).catch(() => []),
      listWarehouseRows("live_trades", 300).catch(() => []),
    ]);

  const entries = filterProductionEntries(entriesRaw);

  const ordersRaw = paperRows
    .map((row) => row.payload as unknown)
    .filter((payload): payload is PaperOrder => {
      if (!payload || typeof payload !== "object") return false;
      const rec = payload as Record<string, unknown>;
      return typeof rec.id === "string" && typeof rec.decisionLogId === "string";
    });

  const liveTrades = liveRows
    .map((row) => row.payload as unknown)
    .filter((payload): payload is LiveTradeJournalEntry => {
      if (!payload || typeof payload !== "object") return false;
      const rec = payload as Record<string, unknown>;
      return typeof rec.liveTradeId === "string" && typeof rec.status === "string";
    });

  return buildGoalTradeList({
    entries,
    orders: filterProductionOrders(ordersRaw),
    unifiedPortfolio,
    testnetSnapshot,
    liveTrades,
  });
}
