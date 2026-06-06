export type OperatorActionType =
  | "RUN_ANALYSIS"
  | "ENABLE_PAPER_AUTOPILOT"
  | "RESOLVE_OUTCOME"
  | "REVIEW_PAPER_TRADE"
  | "CONFIGURE_ALERTS"
  | "ENABLE_SYNC"
  | "REVIEW_RISK_BLOCKER"
  | "APPROVE_RULE"
  | "REJECT_RULE"
  | "REVIEW_STRATEGY"
  | "OPEN_SHADOW_TRADE"
  | "CHECK_EXCHANGE"
  | "NO_ACTION";

export type OperatorActionPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type OperatorActionStatus = "OPEN" | "DONE" | "DISMISSED";

export interface OperatorAction {
  actionId: string;
  type: OperatorActionType;
  priority: OperatorActionPriority;
  title: string;
  description: string;
  reason: string;
  linkedDecisionLogId: string | null;
  linkedTradeId: string | null;
  linkedModule: string | null;
  requiresHumanApproval: boolean;
  status: OperatorActionStatus;
  createdAt: string;
}
