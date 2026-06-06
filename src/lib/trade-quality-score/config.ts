import type { TradeQualityDimensions, TradeQualityGrade } from "./types";

export const TRADE_QUALITY_STORE_FILE = "trade-quality-scores.json";
export const TRADE_QUALITY_MAX_SCORES = 200;

export const TRADE_QUALITY_WEIGHTS: Record<keyof TradeQualityDimensions, number> = {
  setupQuality: 0.12,
  entryQuality: 0.18,
  riskReward: 0.15,
  executionQuality: 0.12,
  exitQuality: 0.13,
  ruleCompliance: 0.15,
  aiReasoningQuality: 0.15,
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
  entryQuality: "Entry quality",
  riskReward: "Risk/reward",
  executionQuality: "Execution quality",
  exitQuality: "Exit quality",
  ruleCompliance: "Rule compliance",
  aiReasoningQuality: "AI reasoning quality",
};
