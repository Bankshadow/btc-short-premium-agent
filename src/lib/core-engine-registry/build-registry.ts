import type {
  CoreEngineId,
  CoreEngineRegistryInput,
  CoreEngineRegistrySnapshot,
  CoreEngineState,
  CoreEngineStatus,
} from "./types";

const ENGINE_LABELS: Record<CoreEngineId, string> = {
  MarketDataEngine: "Market data",
  AgentDecisionEngine: "AI decision",
  StrategyEngine: "Strategy",
  RiskEngine: "Risk",
  PolicyEngine: "Policy & guardrails",
  ExecutionPreviewEngine: "Order preview",
  TestnetExecutionEngine: "Testnet execution",
  PositionMonitorEngine: "Position monitor",
  PnLEngine: "PnL",
  LearningEngine: "Learning",
  NotificationEngine: "Alerts",
  ReportingEngine: "Reports",
};

const ADVANCED_HREF: Partial<Record<CoreEngineId, string>> = {
  MarketDataEngine: "/command-center",
  AgentDecisionEngine: "/council",
  StrategyEngine: "/strategies",
  RiskEngine: "/real-time-risk",
  PolicyEngine: "/policies",
  ExecutionPreviewEngine: "/binance-testnet",
  TestnetExecutionEngine: "/testnet-monitor",
  PositionMonitorEngine: "/testnet-monitor",
  PnLEngine: "/portfolio",
  LearningEngine: "/learning",
  NotificationEngine: "/notifications",
  ReportingEngine: "/reports",
};

function make(
  engineId: CoreEngineId,
  partial: {
    status: CoreEngineStatus;
    lastRunAt?: string | null;
    summary: string;
    importantOutput?: string | null;
    createsTradeSignal?: boolean;
    requiresHumanAction?: boolean;
    detectsRiskBlocker?: boolean;
    error?: string | null;
  },
): CoreEngineState {
  const error = partial.error ?? null;
  const requiresHumanAction = partial.requiresHumanAction ?? false;
  const createsTradeSignal = partial.createsTradeSignal ?? false;
  const detectsRiskBlocker = partial.detectsRiskBlocker ?? false;
  const status: CoreEngineStatus = error ? "ERROR" : partial.status;
  const userVisible =
    Boolean(error) ||
    requiresHumanAction ||
    createsTradeSignal ||
    detectsRiskBlocker ||
    status === "ERROR" ||
    status === "BLOCKED" ||
    status === "ACTION_REQUIRED";
  return {
    engineId,
    label: ENGINE_LABELS[engineId],
    status,
    lastRunAt: partial.lastRunAt ?? null,
    summary: partial.summary,
    importantOutput: partial.importantOutput ?? null,
    userVisible,
    error,
    createsTradeSignal,
    requiresHumanAction,
    detectsRiskBlocker,
    advancedHref: ADVANCED_HREF[engineId] ?? null,
  };
}

export function buildCoreEngineRegistry(
  input: CoreEngineRegistryInput,
): CoreEngineRegistrySnapshot {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const err = input.errors ?? {};

  const engines: CoreEngineState[] = [
    make("MarketDataEngine", {
      status: input.market?.staleWarning ? "DEGRADED" : "OK",
      lastRunAt: input.market?.lastAnalysisAt ?? null,
      summary: input.market?.staleWarning
        ? "Market data is stale — refreshing soon."
        : "Market data is up to date.",
      importantOutput: input.market?.staleWarning ?? null,
      requiresHumanAction: false,
      error: err.MarketDataEngine ?? null,
    }),
    make("AgentDecisionEngine", {
      status: input.agents?.running ? "OK" : "IDLE",
      lastRunAt: input.agents?.lastRunAt ?? null,
      summary: input.agents?.running
        ? "AI is reviewing the market."
        : "AI decision engine is idle.",
      importantOutput: input.agents?.lastVerdict ?? null,
      error: err.AgentDecisionEngine ?? null,
    }),
    make("StrategyEngine", {
      status:
        (input.strategy?.pausedCount ?? 0) > 0
          ? "ACTION_REQUIRED"
          : (input.strategy?.reviewRequiredCount ?? 0) > 0
            ? "DEGRADED"
            : "OK",
      lastRunAt: input.strategy?.lastRunAt ?? null,
      summary:
        (input.strategy?.pausedCount ?? 0) > 0
          ? `${input.strategy?.pausedCount} strategy(ies) paused for review.`
          : "Strategies are healthy.",
      importantOutput:
        (input.strategy?.pausedCount ?? 0) > 0
          ? "A strategy needs your review before it trades again."
          : null,
      requiresHumanAction: (input.strategy?.pausedCount ?? 0) > 0,
      error: err.StrategyEngine ?? null,
    }),
    make("RiskEngine", {
      status: input.risk?.blockNewTrades
        ? "BLOCKED"
        : input.risk?.status === "CAUTION"
          ? "DEGRADED"
          : "OK",
      lastRunAt: input.risk?.lastRunAt ?? null,
      summary: input.risk?.blockNewTrades
        ? "Risk engine has paused new trades."
        : "Risk is within safe limits.",
      importantOutput: input.risk?.blocker ?? null,
      detectsRiskBlocker: Boolean(input.risk?.blockNewTrades),
      requiresHumanAction: Boolean(input.risk?.blockNewTrades),
      error: err.RiskEngine ?? null,
    }),
    make("PolicyEngine", {
      status: (input.policy?.recentBlocks ?? 0) > 0 ? "DEGRADED" : "OK",
      lastRunAt: input.policy?.lastRunAt ?? null,
      summary:
        (input.policy?.recentBlocks ?? 0) > 0
          ? `${input.policy?.recentBlocks} action(s) blocked by guardrails recently.`
          : "Guardrails are passing.",
      error: err.PolicyEngine ?? null,
    }),
    make("ExecutionPreviewEngine", {
      status: input.executionPreview?.pendingPreview ? "ACTION_REQUIRED" : "OK",
      lastRunAt: input.executionPreview?.lastPreviewAt ?? null,
      summary: input.executionPreview?.pendingPreview
        ? "An order preview is waiting for confirmation."
        : "No pending order previews.",
      requiresHumanAction: Boolean(input.executionPreview?.pendingPreview),
      error: err.ExecutionPreviewEngine ?? null,
    }),
    make("TestnetExecutionEngine", {
      status: input.testnetExecution?.failedRecently
        ? "ERROR"
        : input.testnetExecution?.enabled
          ? "OK"
          : "IDLE",
      lastRunAt: input.testnetExecution?.lastExecutedAt ?? null,
      summary: input.testnetExecution?.enabled
        ? "Testnet execution is ready (double confirm required)."
        : "Testnet execution is idle.",
      importantOutput: input.testnetExecution?.failedRecently
        ? "A recent testnet order failed."
        : null,
      error: err.TestnetExecutionEngine ?? null,
    }),
    make("PositionMonitorEngine", {
      status: (input.positionMonitor?.openPositions ?? 0) > 0 ? "OK" : "IDLE",
      lastRunAt: input.positionMonitor?.lastRunAt ?? null,
      summary:
        (input.positionMonitor?.openPositions ?? 0) > 0
          ? `Watching ${input.positionMonitor?.openPositions} open position(s).`
          : "No open positions to monitor.",
      error: err.PositionMonitorEngine ?? null,
    }),
    make("PnLEngine", {
      status: "OK",
      lastRunAt: input.pnl?.lastRunAt ?? null,
      summary: "PnL is being calculated correctly.",
      error: err.PnLEngine ?? null,
    }),
    make("LearningEngine", {
      status: (input.learning?.pendingReview ?? 0) > 0 ? "ACTION_REQUIRED" : "OK",
      lastRunAt: input.learning?.lastRunAt ?? null,
      summary:
        (input.learning?.pendingReview ?? 0) > 0
          ? `${input.learning?.pendingReview} trade(s) waiting for learning review.`
          : "Learning loop is up to date.",
      requiresHumanAction: (input.learning?.pendingReview ?? 0) > 0,
      error: err.LearningEngine ?? null,
    }),
    make("NotificationEngine", {
      status: !input.notification?.anyChannelConfigured
        ? "ACTION_REQUIRED"
        : (input.notification?.recentDeliveryFailures ?? 0) > 0
          ? "DEGRADED"
          : "OK",
      lastRunAt: input.notification?.lastDeliveryAt ?? null,
      summary: !input.notification?.anyChannelConfigured
        ? "No alert channel is configured."
        : "Alerts can be delivered.",
      importantOutput: !input.notification?.anyChannelConfigured
        ? "Set up an alert channel so AI can notify you."
        : null,
      requiresHumanAction: !input.notification?.anyChannelConfigured,
      error: err.NotificationEngine ?? null,
    }),
    make("ReportingEngine", {
      status: "OK",
      lastRunAt: input.reporting?.lastReportAt ?? null,
      summary: "Reports are available.",
      error: err.ReportingEngine ?? null,
    }),
  ];

  const visibleEngines = engines.filter((e) => e.userVisible);

  return {
    generatedAt,
    engines,
    visibleEngines,
    hasError: engines.some((e) => e.error || e.status === "ERROR"),
    hasActionRequired: engines.some((e) => e.requiresHumanAction),
    hasRiskBlocker: engines.some((e) => e.detectsRiskBlocker),
    safetyNotice:
      "Core engines run in the background and are read-only summaries. They cannot enable live trading.",
  };
}
