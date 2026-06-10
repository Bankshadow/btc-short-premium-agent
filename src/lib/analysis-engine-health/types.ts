/** MVP 87 — central analysis engine health dashboard. */
export const ANALYSIS_ENGINE_HEALTH_MVP = 87 as const;
export const ANALYSIS_ENGINE_HEALTH_LABEL = "Analysis Engine Health Dashboard";

export type EngineHealthStatus = "OK" | "WARNING" | "BLOCKED";

export type EngineHealthCheckId =
  | "market_data_fresh"
  | "binance_testnet_connected"
  | "position_monitor_healthy"
  | "decision_log_writable"
  | "journal_writable"
  | "mission_snapshot_updating"
  | "strategy_registry_readable"
  | "governance_readable"
  | "kill_switch_readable"
  | "learning_queue_writable"
  | "reports_updating"
  | "no_orphan_records"
  | "no_duplicate_source_of_truth";

export interface EngineHealthCheck {
  id: EngineHealthCheckId;
  label: string;
  status: EngineHealthStatus;
  message: string;
  detail: string | null;
  lastUpdatedAt: string | null;
  affectsAnalyze: boolean;
  affectsTrade: boolean;
  affectsLearn: boolean;
}

export interface EngineHealthCapability {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
}

export interface EngineHealthSnapshot {
  mvp: typeof ANALYSIS_ENGINE_HEALTH_MVP;
  label: typeof ANALYSIS_ENGINE_HEALTH_LABEL;
  summary: EngineHealthStatus;
  summaryLabel: "Engine OK" | "Warning" | "Blocked";
  generatedAt: string;
  checks: EngineHealthCheck[];
  capabilities: {
    analyze: EngineHealthCapability;
    trade: EngineHealthCapability;
    learn: EngineHealthCapability;
  };
}

export const ENGINE_HEALTH_CHECK_ORDER: EngineHealthCheckId[] = [
  "market_data_fresh",
  "binance_testnet_connected",
  "position_monitor_healthy",
  "decision_log_writable",
  "journal_writable",
  "mission_snapshot_updating",
  "strategy_registry_readable",
  "governance_readable",
  "kill_switch_readable",
  "learning_queue_writable",
  "reports_updating",
  "no_orphan_records",
  "no_duplicate_source_of_truth",
];
