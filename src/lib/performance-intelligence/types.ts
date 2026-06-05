import type { AgentRecommendation } from "@/lib/agents/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { TradeEvaluationResult } from "@/lib/self-learning/types";
import type { AutoDiscoveredRuleProposal } from "@/lib/rule-discovery/types";
import type { AdaptationAuditEntry } from "@/lib/strategy-adaptation/types";
import type { AdaptiveWeightingAuditEntry } from "@/lib/adaptive-agent-weighting/types";
import type { OperatorOverrideLogEntry } from "@/lib/governance/governance-types";
import type { PersistedStrategyRegistry } from "@/lib/strategy-registry/strategy-registry-store";
import type { StrategyId } from "@/lib/validation/validation-types";

export const PERFORMANCE_INTELLIGENCE_SAFETY_NOTICE =
  "Performance intelligence is analytical only — cannot place trades or approve strategy changes.";

export interface AiVersionSnapshot {
  aiPolicyVersion: string;
  strategyRegistryVersion: string;
  ruleSetVersion: string;
  agentWeightVersion: string;
  governanceVersion: string;
  capturedAt: string;
}

export interface PeriodPerformanceSlice {
  periodKey: string;
  periodLabel: string;
  startAt: string;
  endAt: string;
  resolvedTrades: number;
  winRate: number;
  avgPnlPct: number;
  netPnlPct: number;
  committeeAccuracy: number;
  falseTrades: number;
  falseSkips: number;
  regretScore: number;
}

export interface AiImprovementTrend {
  direction: "IMPROVING" | "FLAT" | "DECLINING" | "INSUFFICIENT_DATA";
  weeklyDeltaWinRate: number;
  monthlyDeltaWinRate: number;
  weeklyDeltaPnl: number;
  monthlyDeltaPnl: number;
  summary: string;
}

export interface AgentContributionScore {
  agentName: string;
  contributionScore: number;
  hitRate: number;
  falsePositives: number;
  falseNegatives: number;
  avgRegretScore: number;
  helpfulness: "HIGH" | "MEDIUM" | "LOW";
  notes: string[];
}

export interface CommitteeAccuracyReport {
  totalResolved: number;
  correctVerdicts: number;
  accuracyPct: number;
  tradeCallAccuracy: number;
  skipCallAccuracy: number;
  majorityAlignedWins: number;
}

export interface RiskManagerVetoQuality {
  totalVetoes: number;
  correctVetoes: number;
  accuracyPct: number;
  avoidedLosses: number;
  missedOpportunities: number;
  notes: string[];
}

export interface FalseSignalReport {
  falseTrades: number;
  falseSkips: number;
  opportunityCostR: number;
  avoidedLossR: number;
  avgRegretScore: number;
  topFalseTradeAgents: string[];
  topFalseSkipAgents: string[];
  examples: Array<{
    decisionLogId: string;
    timestamp: string;
    type: "FALSE_TRADE" | "FALSE_SKIP";
    pnlPct: number;
    regime: string;
  }>;
}

export interface RuleImpactSlice {
  ruleId: string;
  title: string;
  approvedAt: string | null;
  tradesBefore: number;
  tradesAfter: number;
  winRateBefore: number;
  winRateAfter: number;
  netPnlBefore: number;
  netPnlAfter: number;
  estimatedImpactPct: number;
}

export interface StrategyVersionPnlSlice {
  strategyId: StrategyId;
  version: string;
  changedAt: string;
  trades: number;
  winRate: number;
  avgPnlPct: number;
  maxDrawdownPct: number;
}

export interface StrategyChangeImpactSlice {
  strategyId: StrategyId;
  changeAt: string;
  changeNote: string;
  pnlBefore: number;
  pnlAfter: number;
  winRateBefore: number;
  winRateAfter: number;
  drawdownAfterChange: number;
}

export interface VersionComparisonReport {
  dimension: string;
  currentLabel: string;
  previousLabel: string;
  currentValue: number;
  previousValue: number;
  delta: number;
  deltaPct: number;
  interpretation: string;
}

export interface StrictRelaxedComparisonReport {
  strictWinRate: number;
  relaxedWinRate: number;
  strictAvgPnl: number;
  relaxedAvgPnl: number;
  strictTrades: number;
  relaxedTrades: number;
  deltaWinRate: number;
  summary: string;
}

export interface WeightedCommitteeComparison {
  totalComparisons: number;
  verdictDiffers: number;
  weightedWouldImprove: number;
  weightedWouldWorsen: number;
  avgDisagreementScore: number;
  summary: string;
}

export interface HumanOverrideComparison {
  totalOverrides: number;
  overrideWasCorrect: number;
  aiWasCorrect: number;
  accuracyPct: number;
  summary: string;
}

export interface PerformanceIntelligenceInput {
  entries: DecisionLogEntry[];
  orders?: PaperOrder[];
  riskProfile?: DeskRiskProfile;
  storedEvaluations?: TradeEvaluationResult[];
  persistedRegistry?: PersistedStrategyRegistry;
  ruleProposals?: AutoDiscoveredRuleProposal[];
  adaptationAudit?: AdaptationAuditEntry[];
  adaptiveWeightingAudit?: AdaptiveWeightingAuditEntry[];
  operatorOverrideLog?: OperatorOverrideLogEntry[];
  governanceAuditCount?: number;
  governanceLastChangeAt?: string | null;
}

export interface PerformanceIntelligenceReport {
  generatedAt: string;
  versions: AiVersionSnapshot;
  improvementTrend: AiImprovementTrend;
  weeklyPerformance: PeriodPerformanceSlice[];
  monthlyPerformance: PeriodPerformanceSlice[];
  agentContribution: AgentContributionScore[];
  committeeAccuracy: CommitteeAccuracyReport;
  riskManagerVetoQuality: RiskManagerVetoQuality;
  falseSignalReport: FalseSignalReport;
  ruleImpact: RuleImpactSlice[];
  strategyVersionPnl: StrategyVersionPnlSlice[];
  strategyChangeImpact: StrategyChangeImpactSlice[];
  regimePerformance: Array<{
    regime: string;
    winRate: number;
    avgPnlPct: number;
    sampleSize: number;
  }>;
  versionComparisons: VersionComparisonReport[];
  strictVsRelaxed: StrictRelaxedComparisonReport;
  weightedVsOriginal: WeightedCommitteeComparison;
  humanOverrideVsAi: HumanOverrideComparison;
  safetyNotice: string;
  analyticalOnly: true;
  cannotPlaceTrades: true;
  cannotApproveChanges: true;
}
