import type { ConfidenceCalibrationReport } from "@/lib/integrated-confidence-calibration/types";
import type { IntegratedStrategyHealthSnapshot } from "@/lib/integrated-strategy-health/types";

/** MVP 91 — strategy health + agent scoreboard v2 attribution. */
export const INTEGRATED_STRATEGY_AGENT_HEALTH_MVP = 91 as const;
export const INTEGRATED_STRATEGY_AGENT_HEALTH_LABEL =
  "Strategy Health & Agent Scoreboard v2";

export interface AgentScoreboardV2EnrichedRow {
  sourceAgent: string;
  sampleCount: number;
  predictionAccuracyPct: number | null;
  falsePositiveRate: number | null;
  falseNegativeRate: number | null;
  avgStatedConfidence: number;
  actualWinRate: number;
  calibrationGap: number;
  overconfident: boolean;
  underconfident: boolean;
  downweightRecommended: boolean;
  alignedTradeQuality: number | null;
  vetoQualityPct: number | null;
  correctTradeCalls: number;
  correctSkips: number;
  falsePositives: number;
  falseNegatives: number;
}

export interface AgentScoreboardV2EnrichedSegment {
  environment: "TESTNET";
  totalSamples: number;
  rows: AgentScoreboardV2EnrichedRow[];
  globalCalibrationGap: number;
  topContributingAgent: string | null;
  weakestAgent: string | null;
  updatedAt: string;
}

export interface IntegratedStrategyAgentHealthSnapshot {
  mvp: typeof INTEGRATED_STRATEGY_AGENT_HEALTH_MVP;
  label: typeof INTEGRATED_STRATEGY_AGENT_HEALTH_LABEL;
  strategyHealth: IntegratedStrategyHealthSnapshot;
  agentScoreboardV2: AgentScoreboardV2EnrichedSegment;
  humanApprovalRequired: true;
  autoStrategyChangeAllowed: false;
  cannotIncreaseLiveRisk: true;
  lastUpdatedAt: string;
}

export interface IntegratedStrategyAgentHealthBuildInput {
  journal: import("@/lib/exchange/binance/binance-types").BinanceTestnetJournalEntry[];
  closedTrades: import("@/lib/testnet-monitor/types").TestnetClosedTrade[];
  learningRecords: import("@/lib/testnet-monitor/types").TestnetLearningRecord[];
  decisions: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  tradeQualityScores: import("@/lib/trade-quality-score/types").TradeQualityScore[];
  strategyHealth: IntegratedStrategyHealthSnapshot;
  confidenceCalibrationReport: ConfidenceCalibrationReport;
}
