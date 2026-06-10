import {
  averageDimensionScores,
  buildOverconfidenceWarning,
  buildStrategyImprovementSuggestion,
} from "./build-quality-calibration-outputs";
import type {
  IntegratedQualityCalibrationBuildInput,
  IntegratedQualityCalibrationSnapshot,
} from "./types";
import {
  INTEGRATED_QUALITY_CALIBRATION_LABEL,
  INTEGRATED_QUALITY_CALIBRATION_MVP,
} from "./types";

export function buildIntegratedQualityCalibration(
  input: IntegratedQualityCalibrationBuildInput,
): IntegratedQualityCalibrationSnapshot {
  const scores = input.tradeQuality.summary.recent.length
    ? input.tradeQuality.summary.recent
    : Object.values(input.tradeQuality.scoresByTradeId);
  const tradeQualityScore = scores[0] ?? null;
  const report = input.confidenceCalibration.report;

  return {
    mvp: INTEGRATED_QUALITY_CALIBRATION_MVP,
    label: INTEGRATED_QUALITY_CALIBRATION_LABEL,
    tradeQualityScore,
    tradeQualitySummary: input.tradeQuality.summary,
    confidenceCalibrationReport: report,
    overconfidenceWarning: buildOverconfidenceWarning(report),
    strategyImprovementSuggestion: buildStrategyImprovementSuggestion({
      latestScore: tradeQualityScore,
      weakestDimension: input.tradeQuality.summary.weakestDimension,
      report,
      strategyHealth: input.strategyHealth,
    }),
    avgDimensionScores: averageDimensionScores(scores),
    autoStrategyChangeAllowed: false,
    cannotIncreaseLiveRisk: true,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function emptyIntegratedQualityCalibration(): IntegratedQualityCalibrationSnapshot {
  const now = new Date().toISOString();
  return {
    mvp: INTEGRATED_QUALITY_CALIBRATION_MVP,
    label: INTEGRATED_QUALITY_CALIBRATION_LABEL,
    tradeQualityScore: null,
    tradeQualitySummary: {
      sampleCount: 0,
      avgCompositeScore: 0,
      avgGrade: null,
      gradeCounts: { A: 0, B: 0, C: 0, D: 0, F: 0 },
      recent: [],
      weakestDimension: null,
      headline: "No trade quality scores yet — close trades to grade decision quality.",
    },
    confidenceCalibrationReport: {
      reportId: "empty",
      generatedAt: now,
      sampleCount: 0,
      bucketStats: [],
      overconfidenceDetected: false,
      underconfidenceDetected: false,
      confidenceAdjustmentRecommendation:
        "Collect closed testnet trades with decisionLogId and confidence to calibrate AI.",
      recommendedSizeMultiplier: 1,
      affectedAgents: [],
      affectedStrategies: [],
      autoAgentWeightChangeAllowed: false,
      cannotIncreaseLiveRisk: true,
    },
    overconfidenceWarning: null,
    strategyImprovementSuggestion: null,
    avgDimensionScores: {},
    autoStrategyChangeAllowed: false,
    cannotIncreaseLiveRisk: true,
    lastUpdatedAt: now,
  };
}
