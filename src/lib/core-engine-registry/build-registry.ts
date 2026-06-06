import type {
  CoreEngineId,
  CoreEngineRegistryInput,
  CoreEngineRegistrySnapshot,
  CoreEngineState,
  CoreEngineStatus,
} from "./types";

const ENGINE_LABELS: Record<CoreEngineId, string> = {
  MarketDataEngine: "Market data",
  AgentDecisionEngine: "AI decisions",
  StrategyEngine: "Strategy",
  RiskEngine: "Risk",
  LedgerEngine: "Trade records",
  PortfolioEngine: "Portfolio",
  TestnetExecutionEngine: "Testnet trading",
  PnLEngine: "Profit & loss",
  LearningEngine: "AI learning",
  ReportingEngine: "Reports",
  NotificationEngine: "Alerts",
  ProjectStrategistEngine: "Project strategist",
};

const ADVANCED_HREF: Partial<Record<CoreEngineId, string>> = {
  MarketDataEngine: "/command-center",
  AgentDecisionEngine: "/cockpit",
  StrategyEngine: "/strategies",
  RiskEngine: "/real-time-risk",
  LedgerEngine: "/ledger",
  PortfolioEngine: "/portfolio",
  TestnetExecutionEngine: "/binance-testnet",
  PnLEngine: "/portfolio",
  LearningEngine: "/learning",
  NotificationEngine: "/notifications",
  ReportingEngine: "/reports",
  ProjectStrategistEngine: "/project-strategist",
};

function make(
  engineId: CoreEngineId,
  partial: {
    status: CoreEngineStatus;
    lastRunAt?: string | null;
    summary: string;
    userVisibleSummary: string;
    requiresHumanAction?: boolean;
    actionLabel?: string | null;
    actionHref?: string | null;
    affectsGoalProgress?: boolean;
    affectsOpenPosition?: boolean;
    affectsRisk?: boolean;
    createsTradeSignal?: boolean;
    detectsRiskBlocker?: boolean;
    error?: string | null;
  },
): CoreEngineState {
  const error = partial.error ?? null;
  const status: CoreEngineStatus = error ? "ERROR" : partial.status;
  const requiresHumanAction = partial.requiresHumanAction ?? false;
  const affectsGoalProgress = partial.affectsGoalProgress ?? false;
  const affectsOpenPosition = partial.affectsOpenPosition ?? false;
  const affectsRisk = partial.affectsRisk ?? false;
  const actionHref = partial.actionHref ?? ADVANCED_HREF[engineId] ?? null;
  const actionLabel = partial.actionLabel ?? null;

  const userVisible =
    Boolean(error) ||
    status === "ERROR" ||
    requiresHumanAction ||
    affectsGoalProgress ||
    affectsOpenPosition ||
    affectsRisk;

  const userVisibleSummary = error
    ? `${partial.userVisibleSummary} (${error})`
    : partial.userVisibleSummary;

  return {
    engineId,
    label: ENGINE_LABELS[engineId],
    status,
    lastRunAt: partial.lastRunAt ?? null,
    summary: partial.summary,
    userVisibleSummary,
    requiresHumanAction,
    actionLabel,
    actionHref,
    userVisible,
    importantOutput: userVisible ? userVisibleSummary : null,
    advancedHref: actionHref,
    error,
    createsTradeSignal: partial.createsTradeSignal ?? false,
    detectsRiskBlocker: partial.detectsRiskBlocker ?? false,
  };
}

export function buildCoreEngineRegistry(
  input: CoreEngineRegistryInput,
): CoreEngineRegistrySnapshot {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const err = input.errors ?? {};

  const ledgerCount = input.ledger?.entryCount ?? 0;
  const ledgerHealthy = input.ledger?.healthy ?? true;
  const dataConnected = input.portfolio?.dataConnected ?? ledgerCount > 0;
  const testnetConfigured = input.testnetExecution?.configured ?? false;
  const testnetConnected = input.testnetExecution?.connected ?? false;
  const openPositions = input.positionMonitor?.openPositions ?? 0;
  const pendingLearning = input.learning?.pendingReview ?? 0;
  const minTrust = input.learning?.minTradesForTrust ?? 12;
  const learnedCount = input.learning?.learnedCount ?? 0;

  const engines: CoreEngineState[] = [
    make("MarketDataEngine", {
      status: input.market?.staleWarning ? "WARNING" : "OK",
      lastRunAt: input.market?.lastAnalysisAt ?? null,
      summary: input.market?.staleWarning
        ? "Market data stale."
        : "Market data up to date.",
      userVisibleSummary: input.market?.staleWarning
        ? "Market prices may be out of date. AI will refresh on the next cycle."
        : "Market prices are current.",
      error: err.MarketDataEngine ?? null,
    }),
    make("AgentDecisionEngine", {
      status: input.agents?.running
        ? "OK"
        : input.agents?.hasRunCycle
          ? "OK"
          : "WARNING",
      lastRunAt: input.agents?.lastRunAt ?? null,
      summary: input.agents?.running
        ? "AI decision engine running."
        : input.agents?.hasRunCycle
          ? "AI decision engine idle."
          : "No AI cycle has run yet.",
      userVisibleSummary: input.agents?.running
        ? "AI is reviewing the market right now."
        : input.agents?.hasRunCycle
          ? "AI is idle between scheduled reviews."
          : "AI has not run its first market review yet.",
      requiresHumanAction: !input.agents?.hasRunCycle,
      actionLabel: "Run first AI cycle",
      actionHref: "/cockpit",
      affectsGoalProgress: !input.agents?.hasRunCycle && ledgerCount === 0,
      error: err.AgentDecisionEngine ?? null,
    }),
    make("StrategyEngine", {
      status:
        (input.strategy?.pausedCount ?? 0) > 0
          ? "WARNING"
          : (input.strategy?.reviewRequiredCount ?? 0) > 0
            ? "WARNING"
            : "OK",
      lastRunAt: input.strategy?.lastRunAt ?? null,
      summary:
        (input.strategy?.pausedCount ?? 0) > 0
          ? `${input.strategy?.pausedCount} strategy paused.`
          : "Strategies healthy.",
      userVisibleSummary:
        (input.strategy?.pausedCount ?? 0) > 0
          ? "A strategy is paused and needs your review before it can trade again."
          : "Trading strategies are healthy.",
      requiresHumanAction: (input.strategy?.pausedCount ?? 0) > 0,
      actionLabel: "Review strategy",
      actionHref: "/strategies",
      error: err.StrategyEngine ?? null,
    }),
    make("RiskEngine", {
      status: input.risk?.blockNewTrades ? "ERROR" : "OK",
      lastRunAt: input.risk?.lastRunAt ?? null,
      summary: input.risk?.blockNewTrades
        ? "Risk engine blocked new trades."
        : "Risk within limits.",
      userVisibleSummary: input.risk?.blockNewTrades
        ? input.risk?.blocker ?? "Trading is paused by the risk engine."
        : "Risk limits are within safe bounds.",
      requiresHumanAction: Boolean(input.risk?.blockNewTrades),
      actionLabel: "View risk status",
      actionHref: "/ai-status",
      affectsRisk: Boolean(input.risk?.blockNewTrades),
      detectsRiskBlocker: Boolean(input.risk?.blockNewTrades),
      error: err.RiskEngine ?? null,
    }),
    make("LedgerEngine", {
      status: ledgerCount === 0 ? "WARNING" : ledgerHealthy ? "OK" : "WARNING",
      lastRunAt: input.ledger?.lastRunAt ?? null,
      summary:
        ledgerCount === 0
          ? "Ledger empty."
          : ledgerHealthy
            ? `Ledger healthy · ${ledgerCount} entries.`
            : "Ledger needs attention.",
      userVisibleSummary:
        ledgerCount === 0
          ? "No trades recorded yet."
          : `${ledgerCount} trade record(s) stored.`,
      affectsGoalProgress: ledgerCount === 0,
      error: err.LedgerEngine ?? null,
    }),
    make("PortfolioEngine", {
      status: dataConnected ? "OK" : "WARNING",
      lastRunAt: input.portfolio?.lastRunAt ?? null,
      summary: dataConnected
        ? "Portfolio data connected."
        : "Portfolio data not connected.",
      userVisibleSummary: dataConnected
        ? "Trade data is connected."
        : "Trade data is not connected yet. Run your first AI cycle or connect Binance Testnet.",
      requiresHumanAction: !dataConnected,
      actionLabel: dataConnected ? null : "Connect trade data",
      actionHref: dataConnected ? null : "/binance-testnet",
      affectsGoalProgress: !dataConnected,
      error: err.PortfolioEngine ?? null,
    }),
    make("TestnetExecutionEngine", {
      status: !testnetConfigured
        ? "DISABLED"
        : input.testnetExecution?.failedRecently
          ? "ERROR"
          : testnetConnected
            ? "OK"
            : "WARNING",
      lastRunAt: input.testnetExecution?.lastExecutedAt ?? null,
      summary: !testnetConfigured
        ? "Testnet not configured."
        : openPositions > 0
          ? `Watching ${openPositions} open position(s).`
          : testnetConnected
            ? "Testnet connected."
            : "Testnet not connected.",
      userVisibleSummary: !testnetConfigured
        ? "Binance Testnet is not connected yet."
        : openPositions > 0
          ? `Watching ${openPositions} open position(s).`
          : testnetConnected
            ? "Binance Testnet is connected (double confirm required for orders)."
            : "Binance Testnet is not connected yet.",
      requiresHumanAction: !testnetConfigured || !testnetConnected,
      actionLabel: openPositions > 0 ? "View current trade" : "Configure Binance Testnet",
      actionHref: openPositions > 0 ? "/trades" : "/binance-testnet",
      affectsOpenPosition: openPositions > 0,
      error: err.TestnetExecutionEngine ?? null,
    }),
    make("PnLEngine", {
      status: "OK",
      lastRunAt: input.pnl?.lastRunAt ?? null,
      summary: `Net PnL ${input.pnl?.netPnlUsd ?? 0}.`,
      userVisibleSummary:
        (input.pnl?.netPnlUsd ?? 0) === 0
          ? "No profit or loss recorded yet."
          : `Net result: ${(input.pnl?.netPnlUsd ?? 0) >= 0 ? "+" : ""}$${Math.abs(input.pnl?.netPnlUsd ?? 0).toFixed(2)}.`,
      affectsGoalProgress: Boolean(input.pnl?.affectsGoalProgress),
      error: err.PnLEngine ?? null,
    }),
    make("LearningEngine", {
      status:
        pendingLearning > 0
          ? "WARNING"
          : learnedCount < minTrust
            ? "WARNING"
            : "OK",
      lastRunAt: input.learning?.lastRunAt ?? null,
      summary:
        pendingLearning > 0
          ? `${pendingLearning} trade(s) pending review.`
          : `${learnedCount} learned · target ${minTrust}.`,
      userVisibleSummary:
        pendingLearning > 0
          ? `${pendingLearning} closed trade(s) need your review so AI can learn.`
          : learnedCount < minTrust
            ? `AI needs ${minTrust} completed trades before its performance can be trusted.`
            : "AI learning is up to date.",
      requiresHumanAction: pendingLearning > 0,
      actionLabel: pendingLearning > 0 ? "Resolve closed trade" : null,
      actionHref: pendingLearning > 0 ? "/" : null,
      affectsGoalProgress: learnedCount < minTrust,
      error: err.LearningEngine ?? null,
    }),
    make("ReportingEngine", {
      status: "OK",
      lastRunAt: input.reporting?.lastReportAt ?? null,
      summary: "Reports available.",
      userVisibleSummary: "Daily and weekly reports are available.",
      error: err.ReportingEngine ?? null,
    }),
    make("NotificationEngine", {
      status: !input.notification?.anyChannelConfigured
        ? "WARNING"
        : (input.notification?.recentDeliveryFailures ?? 0) > 0
          ? "WARNING"
          : "OK",
      lastRunAt: input.notification?.lastDeliveryAt ?? null,
      summary: !input.notification?.anyChannelConfigured
        ? "No alert channel configured."
        : "Alerts can be delivered.",
      userVisibleSummary: !input.notification?.anyChannelConfigured
        ? "No alert channel set up — you may miss important updates."
        : "Alert delivery is configured.",
      requiresHumanAction: !input.notification?.anyChannelConfigured,
      actionLabel: "Set up alerts",
      actionHref: "/notifications",
      error: err.NotificationEngine ?? null,
    }),
    make("ProjectStrategistEngine", {
      status:
        (input.projectStrategist?.pendingProposals ?? 0) > 0 ? "WARNING" : "OK",
      lastRunAt: input.projectStrategist?.lastRunAt ?? null,
      summary: "Project strategist running in background.",
      userVisibleSummary: "Project strategist runs in the background (advanced only).",
      error: err.ProjectStrategistEngine ?? null,
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
      "Core engines run in the background. They cannot enable live trading or auto-execute live orders.",
  };
}
