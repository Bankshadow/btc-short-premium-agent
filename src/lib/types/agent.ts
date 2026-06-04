import type { TradeRecommendation } from "@/lib/types/market";

/** Agent-facing recommendation labels (display + committee). */
export type AgentRecommendation = "TRADE" | "SKIP" | "WAIT";

export type AgentStrategyType =
  | "market_data"
  | "spot"
  | "futures"
  | "options"
  | "risk"
  | "committee"
  | "portfolio";

export type AgentMarketView = "bullish" | "bearish" | "neutral" | "mixed";

export interface ProposedAction {
  instrument: string;
  side: "long" | "short" | "neutral" | "none";
  sizePct: number;
  notes: string;
}

export interface AgentOutput {
  agentName: string;
  marketView: AgentMarketView;
  recommendation: AgentRecommendation;
  strategyType: AgentStrategyType;
  confidence: number;
  reasons: string[];
  risks: string[];
  proposedAction: ProposedAction;
  /** Risk Manager only — blocks committee TRADE */
  veto?: boolean;
  vetoReasons?: string[];
}

export interface AgentDebateRow {
  agentName: string;
  strategyType: AgentStrategyType;
  recommendation: AgentRecommendation;
  confidence: number;
  marketView: AgentMarketView;
  alignedWithMajority: boolean;
}

export interface CommitteeVerdict {
  recommendation: AgentRecommendation;
  confidence: number;
  summary: string;
  topReasons: string[];
  actionPlan: string;
  agreement: "strong" | "mixed" | "split";
  riskVetoApplied: boolean;
  dissent: string[];
}

export interface PortfolioStage {
  label: string;
  targetUsd: number;
  reached: boolean;
}

export interface CapitalSplitProposal {
  reservePct: number;
  growthPct: number;
  experimentalPct: number;
  rationale: string;
}

export interface PortfolioAllocation {
  initialCapitalUsd: number;
  currentCapitalUsd: number;
  goalCapitalUsd: number;
  currentStage: PortfolioStage;
  nextStage: PortfolioStage | null;
  progressPct: number;
  proposeSplit: boolean;
  split: CapitalSplitProposal | null;
  maxLossPerTradePct: number;
  maxDailyLossPct: number;
  notes: string[];
}

export interface TradingDeskOutput {
  analyzedAt: string;
  agents: AgentOutput[];
  debate: AgentDebateRow[];
  riskManager: AgentOutput;
  committee: AgentOutput;
  committeeVerdict: CommitteeVerdict;
  portfolio: AgentOutput;
  portfolioAllocation: PortfolioAllocation;
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
