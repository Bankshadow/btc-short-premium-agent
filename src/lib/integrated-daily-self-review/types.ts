/** MVP 79 — integrated daily AI self-review. */
export const INTEGRATED_DAILY_SELF_REVIEW_MVP = 79 as const;
export const INTEGRATED_DAILY_SELF_REVIEW_LABEL = "Integrated Daily AI Self-Review";

export const INTEGRATED_DAILY_SELF_REVIEW_SAFETY_NOTICE =
  "Daily AI self-review is advisory only — it cannot execute trades, change strategy, or enable live trading. All suggestions require human approval.";

export interface DailySelfReview {
  reviewId: string;
  date: string;
  generatedAt: string;
  missionProgress: string;
  tradesToday: number;
  pnlToday: number;
  bestDecision: string;
  worstDecision: string;
  biggestMistake: string;
  riskBehavior: string;
  executionIssues: string[];
  lessonsLearned: string[];
  tomorrowPlan: string;
  suggestedStrategyAdjustment: string;
  suggestedCursorTask: string;
  /** One-line summary for dashboard badge. */
  oneLineSummary: string;
  linkedLearningRecordIds: string[];
  requiresApproval: true;
  advisoryOnly: true;
  liveTradingLocked: true;
}

export interface IntegratedDailySelfReviewSnapshot {
  mvp: typeof INTEGRATED_DAILY_SELF_REVIEW_MVP;
  label: typeof INTEGRATED_DAILY_SELF_REVIEW_LABEL;
  review: DailySelfReview;
  autoStrategyChangeAllowed: false;
  safetyNotice: typeof INTEGRATED_DAILY_SELF_REVIEW_SAFETY_NOTICE;
  lastUpdatedAt: string;
}
