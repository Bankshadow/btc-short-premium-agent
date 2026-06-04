import type { TradeRecommendation } from "@/lib/types/market";

export type AgentRecommendation = "TRADE" | "SKIP" | "WAIT";

export type AgentStrategyType =
  | "OPTIONS"
  | "SPOT"
  | "FUTURES"
  | "RISK"
  | "THESIS";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

/** TradingAgents-style structured agent output (MVP 2). */
export interface AgentOutput {
  agentName: string;
  recommendation: AgentRecommendation;
  strategyType: AgentStrategyType;
  confidence: ConfidenceLevel;
  marketView: string;
  reasons: string[];
  risks: string[];
  proposedAction: string;
  missingData: string[];
  /** Risk Manager only */
  veto?: boolean;
  vetoReasons?: string[];
}

export interface AgentDebateRow {
  agentName: string;
  strategyType: AgentStrategyType;
  recommendation: AgentRecommendation;
  confidence: ConfidenceLevel;
  marketView: string;
  alignedWithMajority: boolean;
}

export interface CommitteeVerdict {
  finalVerdict: AgentRecommendation;
  consensusSummary: string;
  riskVeto: boolean;
  topReasons: string[];
  finalActionPlan: string;
  agreementNotes: string[];
  disagreementNotes: string[];
}

export interface TradingDeskOutput {
  analyzedAt: string;
  marketRegime: string;
  agents: AgentOutput[];
  bullThesis: AgentOutput;
  bearThesis: AgentOutput;
  riskManager: AgentOutput;
  committee: CommitteeVerdict;
  debate: AgentDebateRow[];
  disclaimer: string;
}

export function tradeRecToAgent(
  rec: TradeRecommendation,
): AgentRecommendation {
  if (rec === "trade") return "TRADE";
  if (rec === "skip") return "SKIP";
  return "WAIT";
}

export function agentRecToTrade(
  rec: AgentRecommendation,
): TradeRecommendation {
  if (rec === "TRADE") return "trade";
  if (rec === "SKIP") return "skip";
  return "wait";
}
