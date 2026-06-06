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
import { getBinanceStatus } from "@/lib/exchange/binance/binance-futures-testnet";
import { filterProductionEntries, filterProductionOrders } from "@/lib/journal/production-filter";
import { buildCoreEngineRegistry } from "@/lib/core-engine-registry";
import { GOAL_MIN_TRADES_FOR_TRUST } from "./types";
import type { CoreEngineRegistrySnapshot } from "@/lib/core-engine-registry";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import { loadServerBackboneRecord } from "@/lib/background-worker/server-backbone";
import { buildGoalProgressSnapshot } from "./build-goal-snapshot";
import {
  buildMissionSnapshotFromGoal,
  resolveProxyProviderLabel,
} from "./build-mission-snapshot";
import { buildGoalTradeList, type GoalTradeRow } from "./build-trade-list";
import type {
  GoalBinanceConnectionSnapshot,
  GoalProgressSnapshot,
  MissionSnapshot,
} from "./types";

export interface GoalDashboardServerPayload {
  goal: GoalProgressSnapshot;
  mission: MissionSnapshot;
  binance: GoalBinanceConnectionSnapshot;
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
    binanceStatus,
    serverBackbone,
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
    getBinanceStatus().catch(() => null),
    loadServerBackboneRecord().catch(() => null),
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
  const testnetConfigured = Boolean(binanceStatus?.configured);
  const testnetConnected = Boolean(binanceStatus?.connected);
  const pendingLearningReview =
    testnetSnapshot?.learningRecords.filter((r) => r.status === "PENDING_REVIEW").length ?? 0;
  const learnedCount =
    testnetSnapshot?.learningRecords.filter((r) => r.status === "LEARNED").length ?? 0;
  const dataConnected =
    entries.length > 0 ||
    orders.length > 0 ||
    testnetConnected ||
    Boolean(unifiedPortfolio);

  const blocker =
    criticalIncident?.title ??
    (riskReport.blockNewTrades
      ? riskReport.triggeredLimits[0] ?? "Risk engine paused new trades."
      : null);

  const lastDeskRun = serverBackbone?.run ?? null;
  const lastCycleAt =
    lastDeskRun?.completedAt ??
    automation?.state.lastSuccessfulRunAt ??
    entries[0]?.timestamp ??
    null;

  const goal = buildGoalProgressSnapshot({
    entries,
    orders,
    unifiedPortfolio,
    testnetSnapshot,
    liveTrades,
    lastDeskRun,
    ai: {
      automationEnabled: settings?.automationEnabled,
      automationPaused: settings?.paused,
      lastRunStatus:
        lastDeskRun?.status === "RUNNING"
          ? "RUNNING"
          : (automation?.state.lastRun?.status ?? null),
      lastRunAt: lastCycleAt,
      lastVerdict: lastVerdict ?? lastDeskRun?.finalVerdict ?? null,
      riskBlocked: riskReport.blockNewTrades,
      blockerReason: blocker,
      nextRunAt: automation?.state.nextRunAt ?? null,
    },
    risk: {
      dailyLossStatus: riskReport.blockNewTrades
        ? "Daily loss limit reached — trading paused."
        : "Within safe daily loss limit.",
      dailyLossLimitLabel: "3% daily loss limit",
      liveLocked: !live.enabled,
      blocker,
      testnetConfigured,
      testnetConnected,
    },
    learning: {
      pendingReview: pendingLearningReview,
      learnedCount,
    },
  });

  const mission = buildMissionSnapshotFromGoal(goal, {
    lastDeskRun,
    learnedTrades: learnedCount,
    pendingLearningReview,
  });

  const binanceBlocker =
    binanceStatus?.blockers?.[0]?.detail ??
    binanceStatus?.error ??
    null;

  const binance: GoalBinanceConnectionSnapshot = {
    configured: Boolean(binanceStatus?.configured),
    testnetEnabled: Boolean(binanceStatus?.testnetEnabled),
    connected: Boolean(binanceStatus?.connected),
    proxyEnabled: Boolean(binanceStatus?.proxyEnabled),
    proxyProvider: resolveProxyProviderLabel(binanceStatus),
    baseUrl: binanceStatus?.baseUrl ?? "",
    upstreamBaseUrl: binanceStatus?.upstreamBaseUrl ?? "",
    autoExecuteEnabled: Boolean(binanceStatus?.autoExecuteEnabled),
    liveLocked: Boolean(binanceStatus?.liveBlocked ?? true),
    blocker: binanceBlocker,
    error: binanceStatus?.error ?? null,
    debugHref: "/binance-testnet",
  };

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
      hasRunCycle: entries.length > 0 || Boolean(automation?.state.lastSuccessfulRunAt),
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
    ledger: {
      healthy: true,
      entryCount: entries.length,
      lastRunAt: entries[0]?.timestamp ?? null,
    },
    portfolio: {
      dataConnected,
      lastRunAt: unifiedPortfolio?.generatedAt ?? null,
    },
    testnetExecution: {
      configured: testnetConfigured,
      connected: testnetConnected,
      enabled: testnetConnected,
      openPositions: testnetSnapshot?.openPositions.length ?? 0,
      requiresDoubleConfirm: true,
      failedRecently: (testnetSnapshot?.executionQuality?.failedOrderCount ?? 0) > 0,
    },
    positionMonitor: {
      openPositions:
        (testnetSnapshot?.openPositions.length ?? 0) +
        (unifiedPortfolio?.openPositions.length ?? 0),
      affectsOpenPosition:
        (testnetSnapshot?.openPositions.length ?? 0) +
          (unifiedPortfolio?.openPositions.length ?? 0) >
        0,
    },
    pnl: {
      netPnlUsd: goal.equity.netPnl,
      affectsGoalProgress: goal.tradeStats.totalTrades > 0,
    },
    learning: {
      learnedCount,
      pendingReview: pendingLearningReview,
      minTradesForTrust: GOAL_MIN_TRADES_FOR_TRUST,
    },
    notification: {
      anyChannelConfigured: observability?.signals.alerts.anyChannelConfigured ?? false,
      recentDeliveryFailures: observability?.signals.alerts.recentDeliveryFailures ?? 0,
      lastDeliveryAt: observability?.signals.alerts.lastDeliveryAt ?? null,
    },
    reporting: {
      lastReportAt: automation?.state.lastSuccessfulRunAt ?? null,
    },
    projectStrategist: {
      pendingProposals: 0,
    },
  });

  return { goal, mission, binance, engines };
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
