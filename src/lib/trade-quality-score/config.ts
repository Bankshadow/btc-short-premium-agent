import type { TradeQualityDimensions, TradeQualityGrade } from "./types";

export const TRADE_QUALITY_STORE_FILE = "trade-quality-scores.json";
export const TRADE_QUALITY_MAX_SCORES = 200;

/** MVP 90 — eight dimensions for integrated trade quality. */
export const TRADE_QUALITY_WEIGHTS: Record<keyof TradeQualityDimensions, number> = {
  setupQuality: 0.11,
  marketRegimeFit: 0.1,
  entryQuality: 0.16,
  exitQuality: 0.12,
  riskReward: 0.14,
  ruleCompliance: 0.14,
  executionQuality: 0.11,
  reasoningConsistency: 0.12,
};

export const TRADE_QUALITY_GRADE_THRESHOLDS: { grade: TradeQualityGrade; min: number }[] = [
  { grade: "A", min: 82 },
  { grade: "B", min: 68 },
  { grade: "C", min: 54 },
  { grade: "D", min: 40 },
  { grade: "F", min: 0 },
];

export const DIMENSION_LABELS: Record<keyof TradeQualityDimensions, string> = {
  setupQuality: "Setup quality",
  marketRegimeFit: "Market regime fit",
  entryQuality: "Entry quality",
  exitQuality: "Exit quality",
  riskReward: "Risk/reward",
  ruleCompliance: "Rule compliance",
  executionQuality: "Execution quality",
  reasoningConsistency: "Reasoning consistency",
};
