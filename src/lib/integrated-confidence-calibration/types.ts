import type { ConfidenceBucketPerformance } from "@/lib/confidence-calibration/types";

import type { ConfidenceCalibrationProfile, ConfidenceCalibrationSample } from "@/lib/confidence-calibration/types";

/** MVP 77 — integrated AI confidence calibration. */
export const INTEGRATED_CONFIDENCE_CALIBRATION_MVP = 77 as const;
export const INTEGRATED_CONFIDENCE_CALIBRATION_LABEL =
  "Integrated AI Confidence Calibration";

export interface AffectedAgentCalibration {
  agentName: string;
  sampleCount: number;
  avgStatedConfidence: number;
  actualWinRate: number;
  calibrationGap: number;
  overconfident: boolean;
  underconfident: boolean;
  /** Advisory only — never auto-applied without operator approval. */
  downweightRecommended: boolean;
}

export interface AffectedStrategyCalibration {
  strategyTag: string;
  sampleCount: number;
  avgStatedConfidence: number;
  actualWinRate: number;
  calibrationGap: number;
  overconfident: boolean;
  underconfident: boolean;
  dominantRegime: string | null;
}

export interface ConfidenceCalibrationReport {
  reportId: string;
  generatedAt: string;
  sampleCount: number;
  bucketStats: ConfidenceBucketPerformance[];
  overconfidenceDetected: boolean;
  underconfidenceDetected: boolean;
  confidenceAdjustmentRecommendation: string;
  recommendedSizeMultiplier: number;
  affectedAgents: AffectedAgentCalibration[];
  affectedStrategies: AffectedStrategyCalibration[];
  autoAgentWeightChangeAllowed: false;
  cannotIncreaseLiveRisk: true;
}

export interface TestnetAgentScoreboardV2Row {
  sourceAgent: string;
  sampleCount: number;
  avgStatedConfidence: number;
  actualWinRate: number;
  calibrationGap: number;
  overconfident: boolean;
  underconfident: boolean;
  downweightRecommended: boolean;
}

export interface TestnetAgentScoreboardV2Segment {
  environment: "TESTNET";
  totalSamples: number;
  rows: TestnetAgentScoreboardV2Row[];
  globalCalibrationGap: number;
  updatedAt: string;
}

export interface IntegratedConfidenceCalibrationSnapshot {
  mvp: typeof INTEGRATED_CONFIDENCE_CALIBRATION_MVP;
  label: typeof INTEGRATED_CONFIDENCE_CALIBRATION_LABEL;
  report: ConfidenceCalibrationReport;
  profile: ConfidenceCalibrationProfile | null;
  agentScoreboardV2: TestnetAgentScoreboardV2Segment;
  autoAgentWeightChangeAllowed: false;
  cannotIncreaseLiveRisk: true;
  lastUpdatedAt: string;
}

export interface IntegratedCalibrationSample extends ConfidenceCalibrationSample {
  tradeId: string;
  strategyTag: string | null;
  marketRegime: string | null;
  qualityScore: number | null;
  sourceAgent: string | null;
}
