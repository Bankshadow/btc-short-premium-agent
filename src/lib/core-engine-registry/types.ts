export type CoreEngineId =
  | "MarketDataEngine"
  | "AgentDecisionEngine"
  | "StrategyEngine"
  | "RiskEngine"
  | "PolicyEngine"
  | "ExecutionPreviewEngine"
  | "TestnetExecutionEngine"
  | "PositionMonitorEngine"
  | "PnLEngine"
  | "LearningEngine"
  | "NotificationEngine"
  | "ReportingEngine";

export type CoreEngineStatus =
  | "OK"
  | "IDLE"
  | "DEGRADED"
  | "BLOCKED"
  | "ERROR"
  | "ACTION_REQUIRED";

export interface CoreEngineState {
  engineId: CoreEngineId;
  label: string;
  status: CoreEngineStatus;
  lastRunAt: string | null;
  summary: string;
  importantOutput: string | null;
  /** Whether this engine should surface on the simple dashboard. */
  userVisible: boolean;
  error: string | null;
  createsTradeSignal: boolean;
  requiresHumanAction: boolean;
  detectsRiskBlocker: boolean;
  advancedHref: string | null;
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
  policy?: {
    recentBlocks?: number;
    lastRunAt?: string | null;
  };
  executionPreview?: {
    lastPreviewAt?: string | null;
    pendingPreview?: boolean;
  };
  testnetExecution?: {
    enabled?: boolean;
    openPositions?: number;
    lastExecutedAt?: string | null;
    requiresDoubleConfirm?: boolean;
    failedRecently?: boolean;
  };
  positionMonitor?: {
    openPositions?: number;
    lastRunAt?: string | null;
  };
  pnl?: {
    netPnlUsd?: number;
    lastRunAt?: string | null;
  };
  learning?: {
    learnedCount?: number;
    pendingReview?: number;
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
  errors?: Partial<Record<CoreEngineId, string>>;
}
