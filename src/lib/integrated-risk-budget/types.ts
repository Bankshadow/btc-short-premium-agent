/** MVP 78 — integrated risk budget optimizer. */
export const INTEGRATED_RISK_BUDGET_MVP = 78 as const;
export const INTEGRATED_RISK_BUDGET_LABEL = "Integrated Risk Budget Optimizer";

export const RISK_BUDGET_SAFETY_NOTICE =
  "Risk budget recommendations are advisory only. AI may recommend lowering risk but cannot increase limits or apply settings without human approval. Live trading remains locked.";

export type RiskBudgetMode = "DEFENSIVE" | "NORMAL" | "OPPORTUNITY" | "COOLDOWN";

export interface RiskBudgetRecommendation {
  recommendationId: string;
  generatedAt: string;
  recommendedMaxNotional: number;
  /** Position size as % of equity per trade. */
  recommendedRiskPerTrade: number;
  /** Daily loss limit (% of equity, negative). */
  recommendedDailyLossLimit: number;
  recommendedMaxOpenPositions: number;
  mode: RiskBudgetMode;
  reasons: string[];
  requiresApproval: true;
  cannotIncreaseAutomatically: true;
  liveTradingLocked: true;
  currentMaxNotional: number;
  currentDailyLossLimitPct: number;
  currentMaxOpenPositions: number;
}

export interface RiskBudgetAnalysis {
  evidenceCompletedTrades: number;
  evidenceRequired: number;
  avgTradeQualityScore: number | null;
  confidenceSizeMultiplier: number;
  strategyHealthStatus: string | null;
  overconfidenceDetected: boolean;
  governanceWarningRecommended: boolean;
}

export interface IntegratedRiskBudgetSnapshot {
  mvp: typeof INTEGRATED_RISK_BUDGET_MVP;
  label: typeof INTEGRATED_RISK_BUDGET_LABEL;
  recommendation: RiskBudgetRecommendation;
  analysis: RiskBudgetAnalysis;
  autoApplyAllowed: false;
  safetyNotice: typeof RISK_BUDGET_SAFETY_NOTICE;
  lastUpdatedAt: string;
}
