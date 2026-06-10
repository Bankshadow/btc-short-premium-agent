import type { ConfidenceCalibrationReport } from "@/lib/integrated-confidence-calibration/types";
import type { IntegratedStrategyHealthSnapshot } from "@/lib/integrated-strategy-health/types";
import type {
  IntegratedTradeQualitySnapshot,
  TradeQualityDimensions,
  TradeQualityScore,
  TradeQualitySummary,
} from "@/lib/trade-quality-score/types";

/** MVP 90 — integrated trade quality + confidence calibration. */
export const INTEGRATED_QUALITY_CALIBRATION_MVP = 90 as const;
export const INTEGRATED_QUALITY_CALIBRATION_LABEL =
  "Integrated Trade Quality & Confidence Calibration";

export interface IntegratedQualityCalibrationSnapshot {
  mvp: typeof INTEGRATED_QUALITY_CALIBRATION_MVP;
  label: typeof INTEGRATED_QUALITY_CALIBRATION_LABEL;
  tradeQualityScore: TradeQualityScore | null;
  tradeQualitySummary: TradeQualitySummary;
  confidenceCalibrationReport: ConfidenceCalibrationReport;
  overconfidenceWarning: string | null;
  strategyImprovementSuggestion: string | null;
  avgDimensionScores: Partial<Record<keyof TradeQualityDimensions, number>>;
  autoStrategyChangeAllowed: false;
  cannotIncreaseLiveRisk: true;
  lastUpdatedAt: string;
}

export interface IntegratedQualityCalibrationBuildInput {
  tradeQuality: IntegratedTradeQualitySnapshot;
  confidenceCalibration: import("@/lib/integrated-confidence-calibration/types").IntegratedConfidenceCalibrationSnapshot;
  strategyHealth?: IntegratedStrategyHealthSnapshot | null;
}
