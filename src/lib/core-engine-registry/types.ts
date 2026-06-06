export type CoreEngineId =
  | "MarketDataEngine"
  | "AgentDecisionEngine"
  | "StrategyEngine"
  | "RiskEngine"
  | "LedgerEngine"
  | "PortfolioEngine"
  | "TestnetExecutionEngine"
  | "PnLEngine"
  | "LearningEngine"
  | "ReportingEngine"
  | "NotificationEngine"
  | "ProjectStrategistEngine";

export type CoreEngineStatus = "OK" | "WARNING" | "ERROR" | "DISABLED";

export interface CoreEngineState {
  engineId: CoreEngineId;
  /** Short label for lists. */
  label: string;
  status: CoreEngineStatus;
  lastRunAt: string | null;
  /** Internal / advanced summary. */
  summary: string;
  /** Plain-language line for the goal dashboard. */
  userVisibleSummary: string;
  requiresHumanAction: boolean;
  actionLabel: string | null;
  actionHref: string | null;
  /** Whether this engine should surface on the simple dashboard. */
  userVisible: boolean;
  /** @deprecated Use userVisibleSummary */
  importantOutput?: string | null;
  /** @deprecated Use actionHref */
  advancedHref?: string | null;
  error?: string | null;
  createsTradeSignal?: boolean;
  detectsRiskBlocker?: boolean;
}

export interface CoreEngineRegistrySnapshot {
  generatedAt: string;
  engines: CoreEngineState[];
  visibleEngines: CoreEngineState[];
  hasError: boolean;
  hasActionRequired: boolean;
  hasRiskBlocker: boolean;
  safetyNotice: string;
}

export interface CoreEngineRegistryInput {
  generatedAt?: string;
  market?: {
    lastAnalysisAt?: string | null;
    staleWarning?: string | null;
    btcPrice?: number | null;
  };
  agents?: {
    lastVerdict?: string | null;
    lastRunAt?: string | null;
    running?: boolean;
    hasRunCycle?: boolean;
  };
  strategy?: {
    activeStrategy?: string | null;
    pausedCount?: number;
    reviewRequiredCount?: number;
    lastRunAt?: string | null;
  };
  risk?: {
    status?: string | null;
    blockNewTrades?: boolean;
    blocker?: string | null;
    lastRunAt?: string | null;
  };
  ledger?: {
    healthy?: boolean;
    entryCount?: number;
    lastRunAt?: string | null;
  };
  portfolio?: {
    dataConnected?: boolean;
    lastRunAt?: string | null;
  };
  testnetExecution?: {
    configured?: boolean;
    connected?: boolean;
    enabled?: boolean;
    openPositions?: number;
    lastExecutedAt?: string | null;
    requiresDoubleConfirm?: boolean;
    failedRecently?: boolean;
  };
  pnl?: {
    netPnlUsd?: number;
    affectsGoalProgress?: boolean;
    lastRunAt?: string | null;
  };
  learning?: {
    learnedCount?: number;
    pendingReview?: number;
    minTradesForTrust?: number;
    lastRunAt?: string | null;
  };
  notification?: {
    anyChannelConfigured?: boolean;
    recentDeliveryFailures?: number;
    lastDeliveryAt?: string | null;
  };
  reporting?: {
    lastReportAt?: string | null;
  };
  projectStrategist?: {
    lastRunAt?: string | null;
    pendingProposals?: number;
  };
  positionMonitor?: {
    openPositions?: number;
    affectsOpenPosition?: boolean;
    lastRunAt?: string | null;
  };
  errors?: Partial<Record<CoreEngineId, string>>;
}
