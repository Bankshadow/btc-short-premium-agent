import type { AgentOutput, AgentRecommendation } from "@/lib/agents/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { AgentEvaluation } from "@/lib/self-learning/types";
import type { RelevantMemoryResult } from "@/lib/memory-graph/types";
import type { StrategyRegistryAnalyzePayload } from "@/lib/strategy-registry/strategy-registry-types";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";

export const ADAPTIVE_WEIGHTING_SAFETY_NOTICE =
  "Adaptive weighting is advisory in paper mode — cannot override risk veto, governance hard rules, data trust CRITICAL, or pre-mortem BLOCK. Cannot enable live execution.";

export interface AdaptiveWeightingSettings {
  adaptiveWeightingEnabled: boolean;
  paperOnlyAdaptiveMode: boolean;
  /** Separate explicit approval required before live desk may use adaptive weights */
  liveAdaptiveApproval: boolean;
  minClosedTradesBeforeWeighting: number;
  maxWeightMultiplier: number;
  recentPerformanceLookback: number;
}

export const DEFAULT_ADAPTIVE_WEIGHTING_SETTINGS: AdaptiveWeightingSettings = {
  adaptiveWeightingEnabled: false,
  paperOnlyAdaptiveMode: true,
  liveAdaptiveApproval: false,
  minClosedTradesBeforeWeighting: 5,
  maxWeightMultiplier: 2,
  recentPerformanceLookback: 10,
};

export interface AgentWeightEntry {
  agentName: string;
  weight: number;
  baseWeight: number;
  historicalAccuracy: number;
  regimeAccuracy: number;
  strategyAccuracy: number;
  assetAccuracy: number;
  calibrationScore: number;
  falsePositivePenalty: number;
  falseNegativePenalty: number;
  riskUsefulness: number;
  recentDecay: number;
  trustedReasons: string[];
  downweightedReasons: string[];
}

export interface AgentWeightProfile {
  generatedAt: string;
  marketRegime: string;
  targetAsset: string;
  targetStrategy: string;
  entries: AgentWeightEntry[];
  totalResolvedSamples: number;
  weightingEnabled: boolean;
  paperOnlyMode: boolean;
}

export interface WeightedCommitteeVerdict {
  weightedVerdict: AgentRecommendation;
  originalVerdict: AgentRecommendation;
  verdictDiffers: boolean;
  weightProfile: AgentWeightProfile;
  explanation: string;
  confidenceAdjustment: number;
  disagreementScore: number;
  reasonTrail: string[];
  hardGatesApplied: string[];
  tradeScore: number;
  skipScore: number;
  waitScore: number;
  advisoryOnly: true;
  cannotEnableLive: true;
}

export interface AdaptiveWeightingAuditEntry {
  id: string;
  timestamp: string;
  marketRegime: string;
  originalVerdict: AgentRecommendation;
  weightedVerdict: AgentRecommendation;
  verdictDiffers: boolean;
  disagreementScore: number;
  hardGatesApplied: string[];
  topTrustedAgent: string | null;
  topDownweightedAgent: string | null;
}

export interface AdaptiveWeightingInput {
  settings: AdaptiveWeightingSettings;
  marketRegime: string;
  riskProfile: DeskRiskProfile;
  agents: AgentOutput[];
  originalVerdict: AgentRecommendation;
  agentEvaluations?: AgentEvaluation[];
  relevantMemory?: RelevantMemoryResult;
  strategyRegistry?: StrategyRegistryAnalyzePayload | null;
  governance?: GovernanceAnalyzePayload | null;
  riskVeto: boolean;
  dataTrustCritical?: boolean;
  preMortemBlock?: boolean;
  targetAsset?: string;
  targetStrategy?: string;
  totalResolvedTrades?: number;
  /** MVP 83 — step5 confidence for calibration-adjusted committee score */
  step5Confidence?: number | null;
  /** When true, adaptive weighting is skipped unless liveAdaptiveApproval is set */
  isLiveContext?: boolean;
}

export interface AdaptiveWeightingAnalyzePayload {
  settings: AdaptiveWeightingSettings;
  agentLeaderboard: AgentEvaluation[];
  totalResolvedTrades: number;
}
