import type { StrategyId } from "@/lib/validation/validation-types";

export type StrategyHealthEnvironment = "PAPER" | "SHADOW" | "TESTNET" | "LIVE";

export type StrategyHealthStatus =
  | "WATCHLIST"
  | "ACTIVE_PAPER"
  | "ACTIVE_TESTNET"
  | "REVIEW_REQUIRED"
  | "PAUSED"
  | "CANDIDATE_FOR_LIVE";

export type StrategyHealthRecommendation =
  | "continue"
  | "gather more samples"
  | "reduce size"
  | "pause strategy"
  | "run risk replay"
  | "promote to next stage";

export interface StrategyEnvironmentHealthMetrics {
  environment: StrategyHealthEnvironment;
  sampleSize: number;
  winRate: number;
  averageR: number;
  totalPnl: number;
  maxDrawdown: number;
  averageDurationMs: number;
}

export interface StrategyAgentAgreementQuality {
  scorePct: number;
  label: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  comparedEntries: number;
}

export interface StrategyHealthRow {
  strategyId: StrategyId;
  strategyLabel: string;
  sampleSize: number;
  winRate: number;
  averageR: number;
  totalPnl: number;
  maxDrawdown: number;
  averageDurationMs: number;
  falseTradeCount: number;
  falseSkipCount: number;
  bestRegime: string;
  worstRegime: string;
  agentAgreementQuality: StrategyAgentAgreementQuality;
  currentStatus: StrategyHealthStatus;
  recommendation: StrategyHealthRecommendation;
  executionReliabilityPct: number;
  executionWarning: boolean;
  environmentMetrics: Record<StrategyHealthEnvironment, StrategyEnvironmentHealthMetrics>;
}

export interface StrategyHealthSummary {
  generatedAt: string;
  rows: StrategyHealthRow[];
  totals: {
    strategies: number;
    watchlist: number;
    activePaper: number;
    activeTestnet: number;
    reviewRequired: number;
    paused: number;
    candidateForLive: number;
  };
  environmentTotals: Record<
    StrategyHealthEnvironment,
    { sampleSize: number; winRate: number; averageR: number; totalPnl: number }
  >;
}

export interface StrategyHealthSignal {
  generatedAt: string;
  totalStrategies: number;
  healthyStrategies: number;
  reviewRequiredCount: number;
  pausedCount: number;
  candidateForLiveCount: number;
  healthScorePct: number;
  /** MVP 84 — avg decision-quality score across recent closed trades */
  tradeQualityAvgScore?: number | null;
  tradeQualityAvgGrade?: string | null;
}

export interface StrategyHealthInput {
  entries: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  orders: import("@/lib/paper/paper-order-types").PaperOrder[];
  unifiedPortfolio?: import("@/lib/portfolio/unified-types").UnifiedPortfolioSnapshot | null;
  testnetSnapshot?: import("@/lib/testnet-monitor/types").TestnetMonitorSnapshot | null;
  liveTrades?: import("@/lib/live-pilot/types").LiveTradeJournalEntry[];
  executionQuality?: import("@/lib/execution-quality/types").ExecutionQualitySummary | null;
}
