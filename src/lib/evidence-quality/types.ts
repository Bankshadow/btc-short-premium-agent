import { GOAL_MIN_TRADES_FOR_TRUST } from "@/lib/goal-engine/types";

/** MVP 89 — evidence quality layer for strategy evaluation. */
export const EVIDENCE_QUALITY_MVP = 89 as const;
export const EVIDENCE_QUALITY_LABEL = "Evidence Quality Layer";

export const EVIDENCE_QUALITY_REQUIRED = GOAL_MIN_TRADES_FOR_TRUST;

export type EvidenceQualityField =
  | "decisionLogId"
  | "closedEvent"
  | "realizedPnl"
  | "entryExitPrice"
  | "strategyTag"
  | "aiConfidence"
  | "riskCheckResult"
  | "learningRecord"
  | "tradeQualityScore";

export type EvidenceQualityLevel = "GOOD" | "POOR" | "INSUFFICIENT";

export interface EvidenceFieldGap {
  field: EvidenceQualityField;
  count: number;
}

export interface EvidenceTradeAssessment {
  tradeId: string;
  symbol: string;
  valid: boolean;
  missingFields: EvidenceQualityField[];
  decisionLogId: string | null;
  closedAt: string | null;
}

export interface EvidenceQualitySnapshot {
  mvp: typeof EVIDENCE_QUALITY_MVP;
  label: typeof EVIDENCE_QUALITY_LABEL;
  validEvidenceCount: number;
  invalidEvidenceCount: number;
  totalCompletedTrades: number;
  missingFields: EvidenceFieldGap[];
  evidenceConfidence: number;
  readinessForStrategyReview: boolean;
  evidenceQualityLevel: EvidenceQualityLevel;
  blocksStrategyHealthReview: boolean;
  blockReason: string | null;
  trades: EvidenceTradeAssessment[];
  generatedAt: string;
}

/** Compact link stored on AnalysisContext. */
export interface AnalysisContextEvidenceQualityLink {
  validEvidenceCount: number;
  invalidEvidenceCount: number;
  evidenceConfidence: number;
  readinessForStrategyReview: boolean;
  blocksStrategyHealthReview: boolean;
  evidenceQualityLevel: EvidenceQualityLevel;
  topMissingField: EvidenceQualityField | null;
}

export interface EvidenceQualityBuildInput {
  journal: import("@/lib/exchange/binance/binance-types").BinanceTestnetJournalEntry[];
  closedTrades: import("@/lib/testnet-monitor/types").TestnetClosedTrade[];
  learningRecords: import("@/lib/testnet-monitor/types").TestnetLearningRecord[];
  decisions: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  tradeQualityScores: import("@/lib/trade-quality-score/types").TradeQualityScore[];
  monitorEvents: import("@/lib/testnet-monitor/types").TestnetMonitorJournalEvent[];
}
