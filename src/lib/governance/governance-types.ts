import type { AgentRecommendation } from "@/lib/agents/types";
import type { OutcomeStatus } from "@/lib/journal/decision-log-types";

/** Placeholder roles — no auth backend in MVP 14. */
export type DeskUserRole = "VIEWER" | "OPERATOR" | "RISK_MANAGER" | "ADMIN";

export type HardRuleId =
  | "stale_market_data"
  | "daily_loss_exceeded"
  | "data_quality_critical"
  | "missing_required_risk_data";

export type IncidentType =
  | "data_failure"
  | "risk_breach"
  | "operator_override"
  | "kill_switch"
  | "paper_sync"
  | "alert_failure"
  | "other";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type IncidentStatus = "open" | "investigating" | "resolved" | "closed";

export interface GovernanceDeskState {
  pauseAnalysis: boolean;
  pausePaperAutoOpen: boolean;
  disableAggressiveMode: boolean;
  disableAlerts: boolean;
  safeMode: boolean;
  operatorPaused: boolean;
  operatorPauseReason: string;
  operatorPausedAt: string | null;
  cooldownUntil: string | null;
  operatorRole: DeskUserRole;
  operatorName: string;
}

export interface OperatorOverrideLogEntry {
  id: string;
  timestamp: string;
  logEntryId: string;
  originalVerdict: AgentRecommendation;
  overriddenVerdict: AgentRecommendation;
  riskVetoState: boolean;
  reason: string;
  operatorName: string;
  operatorRole: DeskUserRole;
  outcomeStatus: OutcomeStatus;
  hardRuleBlocked: boolean;
  hardRuleIds: HardRuleId[];
}

export interface GovernanceAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actorName: string;
  actorRole: DeskUserRole;
  detail: string;
}

export interface DeskIncident {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  affectedDecisionId: string | null;
  rootCause: string;
  correctiveAction: string;
  status: IncidentStatus;
}

export interface HardRuleLockResult {
  locked: boolean;
  activeRules: HardRuleId[];
  forcedVerdict: AgentRecommendation;
  messages: string[];
}

/** Sent on POST /api/analyze for server-side governance gates. */
export interface GovernanceAnalyzePayload {
  safeMode: boolean;
  disableAggressiveMode: boolean;
  pauseAnalysis: boolean;
  hardRules: HardRuleLockResult;
}

export interface GovernanceRuntimeContext {
  safeMode: boolean;
  disableAggressiveMode: boolean;
  hardRules: HardRuleLockResult;
}
