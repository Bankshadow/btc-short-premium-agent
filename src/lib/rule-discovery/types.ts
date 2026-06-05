import type { StrategyId } from "@/lib/validation/validation-types";
import type { RuleImpactSimulatorOutput } from "@/lib/simulation/types";

export const RULE_DISCOVERY_SAFETY_NOTICE =
  "Auto rule discovery is advisory only — no auto-approval, no direct live execution changes. Live-affecting rules require stronger human approval.";

export type DiscoveredRuleType =
  | "BLOCK"
  | "CAUTION"
  | "SIZE_REDUCE"
  | "SIZE_INCREASE"
  | "ALLOW_PAPER"
  | "REVIEW";

export type RuleLifecycleStatus =
  | "discovered"
  | "proposed"
  | "approved"
  | "active"
  | "paused"
  | "retired"
  | "rejected";

export interface DiscoveredPattern {
  patternId: string;
  category: string;
  condition: string;
  rationale: string;
  supportingTradeIds: string[];
  winRate: number;
  avgPnlPct: number;
  sampleSize: number;
  suggestedRuleType: DiscoveredRuleType;
  suggestedScope: RuleSuggestedScope;
  confidence: number;
}

export interface RuleSuggestedScope {
  regime?: string;
  strategyId?: StrategyId;
  agentName?: string;
  paperMode?: "STRICT_PAPER" | "RELAXED_PAPER" | "LIVE";
  productType?: string;
}

export interface RuleDiscoveryImpact extends RuleImpactSimulatorOutput {
  expectedAvoidedLosses: number;
  missedProfits: number;
  tradeFrequencyChangePct: number;
  netImpactPct: number;
}

export interface AutoDiscoveredRuleProposal {
  ruleId: string;
  ruleType: DiscoveredRuleType;
  condition: string;
  rationale: string;
  supportingTrades: string[];
  estimatedImpact: RuleDiscoveryImpact;
  confidence: number;
  suggestedScope: RuleSuggestedScope;
  humanApprovalRequired: true;
  lifecycle: RuleLifecycleStatus;
  patternId: string;
  category: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
  editedCondition: string | null;
  linkedDraftRuleId: string | null;
  linkedStrategyId: StrategyId | null;
  requiresStrongApproval: boolean;
  reversible: true;
}

export interface RuleDiscoveryReport {
  generatedAt: string;
  patterns: DiscoveredPattern[];
  proposals: AutoDiscoveredRuleProposal[];
  discovered: AutoDiscoveredRuleProposal[];
  proposed: AutoDiscoveredRuleProposal[];
  approvalQueue: AutoDiscoveredRuleProposal[];
  rejected: AutoDiscoveredRuleProposal[];
  activeRules: AutoDiscoveredRuleProposal[];
  performanceAfterApproval: Array<{
    ruleId: string;
    title: string;
    linkedDraftRuleId: string | null;
    lifecycle: RuleLifecycleStatus;
    estimatedNetImpactPct: number;
    supportingTrades: number;
  }>;
  safetyNotice: string;
  noAutoApproval: true;
  noDirectLiveChanges: true;
}

export interface RuleDiscoveryInput {
  entries: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  orders?: import("@/lib/paper/paper-order-types").PaperOrder[];
  perpPositions?: import("@/lib/multi-asset/types").PerpPaperPosition[];
  riskProfile?: import("@/lib/desk/desk-risk-policy").DeskRiskProfile;
  evaluations?: import("@/lib/self-learning/types").TradeEvaluationResult[];
  memoryGraph?: import("@/lib/memory-graph/types").MemoryGraphSnapshot;
  registryStrategies?: import("@/lib/strategy-registry/strategy-registry-types").StrategySkill[];
}

export interface ApproveDiscoveredRuleInput {
  proposalId: string;
  reviewerNote?: string;
  editedCondition?: string;
  linkStrategyId?: StrategyId;
  activate?: boolean;
}

export interface RejectDiscoveredRuleInput {
  proposalId: string;
  reviewerNote?: string;
}
