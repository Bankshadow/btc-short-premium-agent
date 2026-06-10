export const TRADE_QUALITY_SAFETY_NOTICE =
  "Trade quality scores are advisory — they grade decision process, not authorization to trade. Poor grades may reduce mission confidence but cannot enable live risk.";

export type TradeQualityGrade = "A" | "B" | "C" | "D" | "F";

export interface TradeQualityDimensions {
  setupQuality: number;
  marketRegimeFit: number;
  entryQuality: number;
  exitQuality: number;
  riskReward: number;
  ruleCompliance: number;
  executionQuality: number;
  reasoningConsistency: number;
}

/** MVP 76 — integrated trade quality for testnet closed trades. */
export const TRADE_QUALITY_MVP = 76 as const;

export interface TradeQualityScore {
  scoreId: string;
  /** MVP 76 — journal / closed trade id when scored from testnet. */
  tradeId?: string | null;
  decisionLogId: string;
  generatedAt: string;
  source: string;
  grade: TradeQualityGrade;
  compositeScore: number;
  /** MVP 76 alias for compositeScore. */
  numericScore?: number;
  dimensions: TradeQualityDimensions;
  /** MVP 90 — mirrors dimensions.reasoningConsistency. */
  reasoningConsistency?: number;
  primaryReason: string;
  improvements: string[];
  /** MVP 76 — top improvement suggestion. */
  improvementSuggestion?: string | null;
  strengths?: string[];
  weaknesses?: string[];
  /** Lower when decisionLogId or agent data missing. */
  dataConfidence?: number;
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
  /** MVP 76 — testnet closed trades scored. */
  testnetScoredCount?: number;
  avgAgentAlignment?: number | null;
}

export interface IntegratedTradeQualitySnapshot {
  mvp: typeof TRADE_QUALITY_MVP;
  label: string;
  summary: TradeQualitySummary;
  scoresByTradeId: Record<string, TradeQualityScore>;
  autoStrategyChangeAllowed: false;
  lastUpdatedAt: string;
}

export interface TradeQualityStatus {
  workspaceId: string;
  summary: TradeQualitySummary;
  lastUpdatedAt: string | null;
  safetyNotice: typeof TRADE_QUALITY_SAFETY_NOTICE;
}
