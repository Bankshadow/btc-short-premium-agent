export const TRADE_QUALITY_SAFETY_NOTICE =
  "Trade quality scores are advisory — they grade decision process, not authorization to trade. Poor grades may reduce mission confidence but cannot enable live risk.";

export type TradeQualityGrade = "A" | "B" | "C" | "D" | "F";

export interface TradeQualityDimensions {
  setupQuality: number;
  entryQuality: number;
  riskReward: number;
  executionQuality: number;
  exitQuality: number;
  ruleCompliance: number;
  aiReasoningQuality: number;
}

export interface TradeQualityScore {
  scoreId: string;
  decisionLogId: string;
  generatedAt: string;
  source: string;
  grade: TradeQualityGrade;
  compositeScore: number;
  dimensions: TradeQualityDimensions;
  primaryReason: string;
  improvements: string[];
  pnlPct: number;
  tradeWouldWin: boolean | null;
  safetyNotice: typeof TRADE_QUALITY_SAFETY_NOTICE;
  advisoryOnly: true;
}

export interface TradeQualityStore {
  workspaceId: string;
  scores: TradeQualityScore[];
  lastUpdatedAt: string | null;
  updatedAt: string;
}

export interface TradeQualitySummary {
  sampleCount: number;
  avgCompositeScore: number;
  avgGrade: TradeQualityGrade | null;
  gradeCounts: Record<TradeQualityGrade, number>;
  recent: TradeQualityScore[];
  weakestDimension: keyof TradeQualityDimensions | null;
  headline: string;
}

export interface TradeQualityStatus {
  workspaceId: string;
  summary: TradeQualitySummary;
  lastUpdatedAt: string | null;
  safetyNotice: typeof TRADE_QUALITY_SAFETY_NOTICE;
}
