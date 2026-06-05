import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { RelevantMemoryResult } from "@/lib/memory-graph/types";
import type { CanonicalRegime } from "@/lib/validation/validation-types";
import type { StrategyId } from "@/lib/validation/validation-types";
import type { SpotQuote } from "@/lib/types/market";
import type { AnalyzeApiResponse, DecisionEngineInput } from "@/lib/types/market";

export const REGIME_BRAIN_SAFETY_NOTICE =
  "Market Regime Brain is advisory only — cannot override risk veto or enable live execution. Recommends routing and sizing adjustments only.";

export type RegimeTaxonomy =
  | "BULL_TREND"
  | "BEAR_TREND"
  | "SIDEWAYS"
  | "HIGH_VOLATILITY"
  | "LOW_VOLATILITY"
  | "VOL_EXPANSION"
  | "VOL_COMPRESSION"
  | "LIQUIDATION_RISK"
  | "MACRO_EVENT_RISK"
  | "BREAKOUT_RISK"
  | "RANGE_BOUND_PREMIUM_SELLING";

export type TradeFrequencyRecommendation = "PAUSE" | "REDUCE" | "NORMAL";

export interface RegimeEvidence {
  signal: string;
  value: string;
  weight: number;
  supports: RegimeTaxonomy;
}

export interface RegimeBrainResult {
  generatedAt: string;
  primaryRegime: RegimeTaxonomy;
  secondaryRegimes: RegimeTaxonomy[];
  canonicalRegime: CanonicalRegime;
  deskLabel: string;
  regimeConfidence: number;
  regimeRisks: string[];
  evidence: RegimeEvidence[];
  recommendedStrategies: StrategyId[];
  blockedStrategies: StrategyId[];
  sizingMultiplier: number;
  tradeFrequencyRecommendation: TradeFrequencyRecommendation;
  safetyNotice: string;
  advisoryOnly: true;
  cannotOverrideRiskVeto: true;
  cannotEnableLive: true;
}

export interface RegimeHistoryEntry {
  id: string;
  timestamp: string;
  primaryRegime: RegimeTaxonomy;
  canonicalRegime: CanonicalRegime;
  deskLabel: string;
  confidence: number;
  btcPrice: number;
}

export interface RegimePerformanceSlice {
  regime: RegimeTaxonomy;
  label: string;
  sessions: number;
  resolved: number;
  winRate: number;
  netPnlPct: number;
}

export interface RegimeBrainReport {
  generatedAt: string;
  current: RegimeBrainResult;
  history: RegimeHistoryEntry[];
  regimePerformance: RegimePerformanceSlice[];
  safetyNotice: string;
}

export interface RegimeBrainInput {
  input: DecisionEngineInput;
  response: AnalyzeApiResponse;
  ethQuote?: SpotQuote | null;
  recentEntries?: DecisionLogEntry[];
  relevantMemory?: RelevantMemoryResult;
}
