import type { DeskMemorySnapshot } from "@/lib/memory/types";
import type { ResearchBrief } from "@/lib/research/research-types";
import type { TradeRecommendation } from "@/lib/types/market";

export type AgentRecommendation = "TRADE" | "SKIP" | "WAIT";

export type AgentStrategyType =
  | "OPTIONS"
  | "SPOT"
  | "FUTURES"
  | "RISK"
  | "THESIS"
  | "MEMORY"
  | "RESEARCH";

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
  research: ResearchBrief;
  deskMemory: DeskMemorySnapshot;
  agents: AgentOutput[];
  bullThesis: AgentOutput;
  bearThesis: AgentOutput;
  riskManager: AgentOutput;
  committee: CommitteeVerdict;
  /** MVP 32 — performance-weighted committee overlay (advisory; paper-first) */
  weightedCommittee?: import("@/lib/adaptive-agent-weighting/types").WeightedCommitteeVerdict | null;
  /** MVP 35 — deep regime classification and strategy routing */
  regimeBrain?: import("@/lib/market-regime-brain/types").RegimeBrainResult;
  /** MVP 37 — risk budget and position sizing */
  riskBudget?: import("@/lib/risk-budget-optimizer/types").RiskBudgetResult;
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
