import type { TradeRecommendation } from "@/lib/types/market";

export type AgentRecommendation = "TRADE" | "SKIP" | "WAIT";

export type AgentStrategyType =
  | "SPOT"
  | "FUTURES"
  | "OPTIONS"
  | "RISK"
  | "PORTFOLIO"
  | "MARKET_DATA"
  | "REGIME"
  | "COMMITTEE";

export type AgentMarketView = "bullish" | "bearish" | "neutral" | "mixed";

export type MarketRegimeLabel =
  | "risk_on_trend"
  | "risk_off_trend"
  | "range_bound"
  | "liquidation_stress"
  | "macro_caution"
  | "unclear";

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
  requiredData: string[];
  missingData: string[];
  veto?: boolean;
  vetoReasons?: string[];
}

export interface MarketRegimeSnapshot {
  label: MarketRegimeLabel;
  title: string;
  description: string;
  agent: AgentOutput;
}

export interface MissionControlStatus {
  mode: "analysis_only";
  humanApprovalRequired: true;
  autoExecution: false;
  privateKeysRequired: false;
  activeAgents: number;
  lastAnalyzedAt: string;
  deskHealth: "ready" | "degraded" | "blocked";
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
  actionSummary: string;
  /** @deprecated alias */
  actionPlan: string;
  agreement: "strong" | "mixed" | "split";
  agreementNotes: string[];
  disagreementNotes: string[];
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

export interface PortfolioMilestones {
  initialCapitalUsd: number;
  currentCapitalUsd: number;
  goalCapitalUsd: number;
  milestonesUsd: readonly number[];
  currentStage: PortfolioStage;
  nextStage: PortfolioStage | null;
  progressPct: number;
  doubledAtStage: boolean;
  proposeSplit: boolean;
  split: CapitalSplitProposal | null;
  maxRiskPerTradePct: number;
  maxDailyLossPct: number;
  maxWeeklyLossPct: number;
  notes: string[];
}

/** @deprecated use PortfolioMilestones */
export type PortfolioAllocation = PortfolioMilestones;

export interface TradingDeskOutput {
  analyzedAt: string;
  missionControl: MissionControlStatus;
  regime: MarketRegimeSnapshot;
  agents: AgentOutput[];
  debate: AgentDebateRow[];
  riskManager: AgentOutput;
  committee: AgentOutput;
  committeeVerdict: CommitteeVerdict;
  portfolio: AgentOutput;
  portfolioMilestones: PortfolioMilestones;
  /** @deprecated */
  portfolioAllocation: PortfolioMilestones;
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

export const REGIME_LABELS: Record<MarketRegimeLabel, string> = {
  risk_on_trend: "Risk-on trend",
  risk_off_trend: "Risk-off trend",
  range_bound: "Range-bound",
  liquidation_stress: "Liquidation stress",
  macro_caution: "Macro caution",
  unclear: "Unclear",
};
