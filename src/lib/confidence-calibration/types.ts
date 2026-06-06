export const CONFIDENCE_CALIBRATION_SAFETY_NOTICE =
  "Confidence calibration may reduce risk and downweight overconfident agents automatically. It cannot increase live risk or raise position sizing without operator approval.";

export interface ConfidenceBucketDefinition {
  id: string;
  min: number;
  max: number;
  label: string;
}

export interface ConfidenceCalibrationSample {
  sampleId: string;
  decisionLogId: string;
  confidenceBeforeTrade: number;
  actualWin: boolean;
  pnlPct: number;
  result: "WIN" | "LOSS" | "BREAKEVEN" | "UNKNOWN";
  source: string;
  evaluatedAt: string;
}

export interface ConfidenceBucketPerformance {
  bucketId: string;
  label: string;
  min: number;
  max: number;
  sampleCount: number;
  winRate: number;
  avgConfidence: number;
  avgPnlPct: number;
  /** Expected win rate from stated confidence minus actual — positive = overconfident. */
  calibrationGap: number;
  overconfident: boolean;
}

export interface OverconfidentAgentSummary {
  agentName: string;
  calibrationError: number;
  hitRate: number;
  totalCalls: number;
  downweightRecommended: boolean;
}

export interface ConfidenceCalibrationProfile {
  generatedAt: string;
  totalSamples: number;
  buckets: ConfidenceBucketPerformance[];
  globalOverconfidenceGap: number;
  recommendedSizeMultiplier: number;
  recommendedCommitteeMultiplier: number;
  overconfidentAgents: OverconfidentAgentSummary[];
  headline: string;
  safetyNotice: typeof CONFIDENCE_CALIBRATION_SAFETY_NOTICE;
  canReduceRiskAutomatically: true;
  cannotIncreaseLiveRisk: true;
}

export interface ConfidenceCalibrationStore {
  workspaceId: string;
  samples: ConfidenceCalibrationSample[];
  profile: ConfidenceCalibrationProfile | null;
  lastUpdatedAt: string | null;
  updatedAt: string;
}

export interface ConfidenceCalibrationStatus {
  workspaceId: string;
  profile: ConfidenceCalibrationProfile | null;
  sampleCount: number;
  lastUpdatedAt: string | null;
  safetyNotice: typeof CONFIDENCE_CALIBRATION_SAFETY_NOTICE;
}
