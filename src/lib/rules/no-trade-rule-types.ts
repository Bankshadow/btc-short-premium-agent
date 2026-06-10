export type NoTradeRuleCode =
  | "ENGINE_HEALTH_BLOCKED"
  | "RECONCILIATION_BLOCKED"
  | "BINANCE_DISCONNECTED"
  | "DAILY_LOSS_LIMIT"
  | "CONSECUTIVE_LOSSES"
  | "AGENT_DISAGREEMENT_HIGH"
  | "REGIME_UNKNOWN_HIGH_VOL"
  | "REPEATED_SETUP_FAILURE";

export interface NoTradeRuleTrigger {
  code: NoTradeRuleCode;
  message: string;
  severity: "BLOCK" | "WARN";
}

export interface RuleEvaluationResult {
  evaluatedAt: string;
  triggered: NoTradeRuleTrigger[];
  blocked: boolean;
  blockReason: string | null;
  message: string;
}
