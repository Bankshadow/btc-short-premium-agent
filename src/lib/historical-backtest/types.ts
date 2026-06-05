import type { AgentRecommendation } from "@/lib/agents/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { AdaptiveWeightingAnalyzePayload } from "@/lib/adaptive-agent-weighting/types";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";
import type { StrategyRegistryAnalyzePayload } from "@/lib/strategy-registry/strategy-registry-types";
import type { RegimeTaxonomy } from "@/lib/market-regime-brain/types";
import type { StrategyId } from "@/lib/validation/validation-types";
import type { TradeRecommendation } from "@/lib/types/market";

export const HISTORICAL_BACKTEST_SAFETY_NOTICE =
  "Historical backtest is simulation only — cannot enable live trading or auto-approve strategy changes. Results inform readiness and adaptation review.";

export interface HistoricalMarketBar {
  timestamp: string;
  spotPrice: number;
  priceChange24hPct: number;
  hv30: number;
  iv: number;
  ivHvRatio: number;
  ivRank: number;
  ivPercentile: number;
  trend: "bullish" | "bearish" | "neutral";
  fundingRate: number;
  openInterestBtc: number;
  oiChange24hPct: number;
  volume24hBtc: number;
  volumeChange24hPct: number;
}

export interface HistoricalOptionsSnapshot {
  timestamp: string;
  spotPrice: number;
  candidateCount: number;
  bestStrike: number;
  bestExpiry: string;
  impliedVolatility: number;
  annualizedYieldPct: number;
}

export interface HistoricalFundingSnapshot {
  timestamp: string;
  fundingRate: number;
  openInterestBtc: number;
  oiChange24hPct: number;
}

export interface HistoricalRegimeSnapshot {
  timestamp: string;
  deskLabel: string;
  primaryRegime: RegimeTaxonomy;
  confidence: number;
}

export interface BacktestScenario {
  id: string;
  label: string;
  versionTag: string;
  dateFrom?: string;
  dateTo?: string;
  maxSessions?: number;
  riskProfile: DeskRiskProfile;
  strategyRegistry?: StrategyRegistryAnalyzePayload | null;
  governance?: GovernanceAnalyzePayload | null;
  adaptiveWeighting?: AdaptiveWeightingAnalyzePayload | null;
  enableAdaptiveWeighting?: boolean;
  /** Tighter governance simulation for proposed-rule comparison */
  proposedRuleTightening?: boolean;
}

export interface BacktestRun {
  id: string;
  scenarioId: string;
  scenarioLabel: string;
  versionTag: string;
  startedAt: string;
  completedAt: string;
  simulationOnly: true;
  cannotEnableLive: true;
  cannotAutoApprove: true;
}

export interface BacktestTrade {
  logId: string;
  timestamp: string;
  btcPrice: number;
  marketRegime: string;
  loggedVerdict: AgentRecommendation;
  simulatedVerdict: AgentRecommendation;
  simulatedRiskVeto: boolean;
  playbookVerdict: TradeRecommendation;
  aligned: boolean;
  pnlPct: number | null;
  primaryRegime: RegimeTaxonomy;
  strategiesRecommended: StrategyId[];
  strategiesBlocked: StrategyId[];
  ruleTriggers: string[];
  falseTrade: boolean;
  falseSkip: boolean;
  missedOpportunity: boolean;
  riskVetoBlocked: boolean;
}

export interface BacktestMetrics {
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRate: number;
  averageWinPct: number;
  averageLossPct: number;
  expectancy: number;
  tradeFrequency: number;
  longestLossStreak: number;
  missedOpportunityCount: number;
  falseTradeCount: number;
  falseSkipCount: number;
  riskVetoImpact: {
    vetoCount: number;
    tradesBlocked: number;
    pnlSavedPct: number;
  };
  sessionsReplayed: number;
  alignmentRate: number;
}

export interface EquityCurvePoint {
  timestamp: string;
  equityPct: number;
  drawdownPct: number;
}

export interface BacktestRuleImpactRow {
  ruleId: string;
  label: string;
  triggerCount: number;
  tradesAffected: number;
  estimatedPnlDeltaPct: number;
}

export interface BacktestRegimeSlice {
  regime: RegimeTaxonomy;
  label: string;
  sessions: number;
  simulatedTrades: number;
  winRate: number;
  netPnlPct: number;
}

export interface BacktestResult {
  run: BacktestRun;
  metrics: BacktestMetrics;
  trades: BacktestTrade[];
  equityCurve: EquityCurvePoint[];
  ruleImpact: BacktestRuleImpactRow[];
  regimeBreakdown: BacktestRegimeSlice[];
  safetyNotice: string;
}

export interface StrategyVersionComparison {
  baselineVersion: string;
  proposedVersion: string;
  baselineMetrics: BacktestMetrics;
  proposedMetrics: BacktestMetrics;
  deltaReturnPct: number;
  deltaWinRate: number;
  deltaTradeFrequency: number;
  deltaFalseTrade: number;
  deltaFalseSkip: number;
  recommendation: string;
}

export interface BacktestCompareResult {
  generatedAt: string;
  comparison: StrategyVersionComparison;
  baseline: BacktestResult;
  proposed: BacktestResult;
  safetyNotice: string;
}

export interface RunBacktestInput {
  scenario: BacktestScenario;
  entries: DecisionLogEntry[];
  orders?: PaperOrder[];
}

export interface BacktestAdaptationBridge {
  lastRunId: string;
  versionTag: string;
  totalReturnPct: number;
  winRate: number;
  falseTradeCount: number;
  falseSkipCount: number;
  sessionsReplayed: number;
  alignmentRate: number;
  simulationOnly: true;
}

export interface BacktestReadinessBridge {
  hasRecentBacktest: boolean;
  alignmentRate: number;
  falseTradeCount: number;
  expectancy: number;
  sessionsReplayed: number;
  note: string;
}
