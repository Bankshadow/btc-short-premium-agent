import type { AgentRecommendation } from "@/lib/agents/types";
import type { StrategyId } from "@/lib/validation/validation-types";

export const SELF_LEARNING_SAFETY_NOTICE =
  "Self-learning evaluation is advisory only — cannot auto-change live trading. Improvement proposals require human approval on /adaptation.";

export type PostTradeEvaluationSource =
  | "paper_close"
  | "manual_resolve"
  | "live_pilot_close"
  | "paper_autopilot_resolve"
  | "testnet_close";

export interface AgentPredictionScore {
  hitRate: number;
  avgPnlAfterTradeRec: number;
  avoidedLossAfterSkip: number;
  opportunityCostWrongSkip: number;
  lossFromWrongTrade: number;
  falsePositives: number;
  falseNegatives: number;
  correctTradeCalls: number;
  correctSkips: number;
  totalCalls: number;
}

export interface AgentReasoningScore {
  riskWarningUsefulness: number;
  missedRiskFactors: string[];
  reasoningQuality: number;
  confidenceCalibrationError: number;
  regretScore: number;
}

export interface ContextPerformanceSlice {
  label: string;
  hitRate: number;
  sampleSize: number;
  avgPnlPct: number;
}

export interface AgentEvaluation {
  agentName: string;
  prediction: AgentPredictionScore;
  reasoning: AgentReasoningScore;
  contributionToVerdict: number;
  vetoQuality?: number;
  byRegime: ContextPerformanceSlice[];
  byAsset: ContextPerformanceSlice[];
  byStrategy: ContextPerformanceSlice[];
  overallGrade: "A" | "B" | "C" | "D" | "F" | "INSUFFICIENT_DATA";
  helpingScore: number;
}

export interface StrategyEvaluation {
  strategyId: StrategyId;
  label: string;
  hitRate: number;
  avgPnlPct: number;
  sampleSize: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  bestRegime: string | null;
  worstRegime: string | null;
  agentAlignment: string;
}

export interface RegimeEvaluation {
  regime: string;
  hitRate: number;
  avgPnlPct: number;
  sampleSize: number;
  bestAgent: string | null;
  worstAgent: string | null;
  dominantStrategy: StrategyId | null;
}

export interface TradeEvaluationResult {
  evaluationId: string;
  decisionLogId: string;
  liveTradeId?: string;
  generatedAt: string;
  source: PostTradeEvaluationSource;
  marketRegime: string;
  asset: string;
  strategies: StrategyId[];
  pnlPct: number;
  tradeWouldWin: boolean | null;
  finalVerdict: AgentRecommendation;
  agentEvaluations: AgentEvaluation[];
  committeeEvaluation: AgentEvaluation;
  improvementHints: string[];
  /** MVP 84 — decision-quality grade independent of PnL alone */
  tradeQuality?: import("@/lib/trade-quality-score/types").TradeQualityScore | null;
}

export interface ImprovementRecommendation {
  id: string;
  target: "agent" | "strategy" | "regime" | "desk";
  targetId: string;
  title: string;
  problem: string;
  suggestedAction: string;
  adaptationProposalHint: string;
  confidence: number;
}

export interface LearningEvaluationReport {
  generatedAt: string;
  totalEvaluations: number;
  agentLeaderboard: AgentEvaluation[];
  agentWeaknesses: Array<{
    agentName: string;
    weakness: string;
    evidence: string;
    severity: "low" | "medium" | "high";
  }>;
  strategyReports: StrategyEvaluation[];
  regimeReports: RegimeEvaluation[];
  recentResults: TradeEvaluationResult[];
  improvementRecommendations: ImprovementRecommendation[];
  safetyNotice: string;
  cannotAutoChangeLive: true;
  proposalsOnly: true;
}

export const CORE_EVALUATION_AGENTS = [
  "Bull Thesis Agent",
  "Bear Thesis Agent",
  "Spot Strategy Agent",
  "Futures Strategy Agent",
  "Options Strategy Agent",
  "Risk Manager Agent",
  "Data Quality Agent",
  "Macro & News Agent",
] as const;

export const COMMITTEE_AGENT_NAME = "Investment Committee";
