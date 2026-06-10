import { GOAL_MIN_TRADES_FOR_TRUST } from "@/lib/goal-engine/types";

/** MVP 74 — strategy health after 12 valid testnet trades. */
export const INTEGRATED_STRATEGY_HEALTH_MVP = 74 as const;
export const INTEGRATED_STRATEGY_HEALTH_LABEL =
  "Integrated Strategy Health After 12 Trades";

export const STRATEGY_HEALTH_EVIDENCE_REQUIRED = GOAL_MIN_TRADES_FOR_TRUST;

export type StrategyHealthStatus =
  | "CONTINUE"
  | "PAUSE"
  | "REDUCE_RISK"
  | "NEEDS_MORE_DATA"
  | "REJECT";

export interface StrategyHealthReport {
  reportId: string;
  strategyTag: string;
  status: StrategyHealthStatus;
  evidenceCount: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
  biggestWeakness: string | null;
  bestPattern: string | null;
  recommendation: string;
  nextAction: string;
  linkedDecisionIds: string[];
  linkedTradeIds: string[];
  linkedLearningRecordIds: string[];
  avgTradeQualityScore: number | null;
  riskVetoRate: number;
  agentTradeAgreementRate: number;
  /** MVP 77 — strategy-level confidence calibration gap when available. */
  confidenceCalibrationGap: number | null;
  confidenceOverconfident: boolean;
  netPnl: number;
  reviewedAt: string;
}

export interface StrategyRegistryHealthRecommendation {
  strategyTag: string;
  status: StrategyHealthStatus;
  recommendation: string;
  nextAction: string;
  reportId: string;
  reviewedAt: string;
  /** Recommendation only — never auto-promote/demote registry status. */
  advisoryOnly: true;
}

export interface IntegratedStrategyHealthSnapshot {
  mvp: typeof INTEGRATED_STRATEGY_HEALTH_MVP;
  label: typeof INTEGRATED_STRATEGY_HEALTH_LABEL;
  evidenceRequired: number;
  evidenceReady: boolean;
  primaryReport: StrategyHealthReport | null;
  reportsByTag: StrategyHealthReport[];
  registryRecommendation: StrategyRegistryHealthRecommendation | null;
  agentScoreboardLearned: number;
  governanceWarningActive: boolean;
  blocksNewTestnetEntries: boolean;
  autoStrategyChangeAllowed: false;
  liveTradingBlocked: true;
  /** MVP 77 — integrated confidence calibration summary. */
  confidenceOverconfidenceDetected: boolean;
  confidenceAdjustmentRecommendation: string | null;
  /** MVP 89 — strategy health blocked when evidence quality is poor. */
  evidenceQualityBlocked: boolean;
  evidenceQualityBlockReason: string | null;
  lastUpdatedAt: string;
}

export interface IntegratedStrategyHealthBuildInput {
  journal: import("@/lib/exchange/binance/binance-types").BinanceTestnetJournalEntry[];
  closedTrades: import("@/lib/testnet-monitor/types").TestnetClosedTrade[];
  learningRecords: import("@/lib/testnet-monitor/types").TestnetLearningRecord[];
  decisions: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  evidenceCompletedTrades: number;
  evidenceValidTrades: import("@/lib/evidence-progress/types").EvidenceProgressRow[];
  tradeQualityScores?: import("@/lib/trade-quality-score/types").TradeQualityScore[];
  agentScoreboardLearned?: number;
  confidenceCalibrationReport?: import("@/lib/integrated-confidence-calibration/types").ConfidenceCalibrationReport | null;
  persistSideEffects?: boolean;
  evidenceQuality?: import("@/lib/evidence-quality/types").EvidenceQualitySnapshot | null;
}
