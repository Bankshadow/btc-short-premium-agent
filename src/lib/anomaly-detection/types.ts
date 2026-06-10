export type AnomalySeverity = "INFO" | "WARNING" | "CRITICAL";

export type AnomalyIncidentStatus =
  | "OPEN"
  | "INVESTIGATING"
  | "RESOLVED"
  | "SUPPRESSED";

export type AnomalyType =
  | "exchange_disconnected"
  | "order_executed_no_ledger_entry"
  | "ledger_entry_no_exchange_order"
  | "position_size_mismatch"
  | "duplicate_order"
  | "stale_market_data"
  | "pnl_calculation_mismatch"
  | "alert_delivery_failed"
  | "automation_job_failed"
  | "testnet_live_flag_mismatch"
  | "unexpected_open_position"
  | "close_reduce_only_failed"
  | "execution_quality_degraded"
  | "monitor_reliability_degraded"
  | "strategy_health_governance"
  | "micro_live_readiness_blocked"
  | "risk_budget_governance";

export type IncidentActor = "AI" | "USER" | "SYSTEM";

export interface AnomalyFinding {
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  evidence: Record<string, unknown>;
  impactedModules: string[];
  recommendedAction: string;
  fingerprint: string;
}

export interface AnomalyIncident {
  incidentId: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  evidence: Record<string, unknown>;
  impactedModules: string[];
  recommendedAction: string;
  status: AnomalyIncidentStatus;
  fingerprint: string;
  autoCreated: true;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedBy: IncidentActor | null;
  resolutionNote: string | null;
}

export interface AnomalyDetectionSummary {
  generatedAt: string;
  findings: AnomalyFinding[];
  incidents: AnomalyIncident[];
  openCount: number;
  warningOpenCount: number;
  criticalOpenCount: number;
  blocksRiskyActions: boolean;
}
