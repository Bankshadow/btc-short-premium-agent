import type { AgentRecommendation } from "@/lib/agents/types";
import type { StrategyRegistryStatus } from "@/lib/strategy-registry/strategy-registry-types";
import type { StrategyId } from "@/lib/validation/validation-types";

export const EXPERIMENT_SAFETY_NOTICE =
  "Strategy experiments are isolated sandbox runs — cannot place live trades or change active strategy without human approval.";

export const EXPERIMENT_LABEL_PREFIX = "[EXPERIMENT]";

export type ExperimentSource =
  | "council_proposal"
  | "rule_discovery"
  | "self_learning"
  | "user_hypothesis"
  | "memory_graph";

export type ExperimentMode =
  | "historical_replay"
  | "forward_paper_shadow"
  | "relaxed_paper"
  | "strict_paper";

export type ExperimentStatus =
  | "draft"
  | "running"
  | "active"
  | "completed"
  | "failed"
  | "promotion_pending"
  | "promoted"
  | "archived";

export interface ExperimentHypothesis {
  summary: string;
  expectedOutcome: string;
  sourceRef?: string;
}

export interface ExperimentCriteria {
  success: string;
  failure: string;
  minWinRate?: number;
  minSampleSize?: number;
  minNetPnlPct?: number;
}

export interface StrategyVariant {
  targetStrategy: StrategyId;
  modifiedRules: string[];
  targetRegime: string;
  targetAsset: string;
  entryCondition: string;
  exitCondition: string;
  sizingRule: string;
  riskLimits: string[];
  successCriteria: ExperimentCriteria;
  failureCriteria: ExperimentCriteria;
}

export interface ShadowTradeRecord {
  id: string;
  decisionLogId: string;
  timestamp: string;
  marketRegime: string;
  committeeVerdict: AgentRecommendation;
  shadowVerdict: AgentRecommendation;
  aligned: boolean;
  hypotheticalPnlPct: number | null;
  actualPnlPct: number | null;
  notes: string;
}

export interface ExperimentResult {
  completedAt: string;
  sampleSize: number;
  winRate: number;
  netPnlPct: number;
  shadowAccuracyPct: number;
  tradeFrequencyDelta: number;
  passedSuccess: boolean;
  passedFailure: boolean;
  summary: string;
}

export interface ExperimentPromotionProposal {
  proposalId: string;
  experimentId: string;
  targetStrategy: StrategyId;
  proposedRegistryStatus: StrategyRegistryStatus;
  reason: string;
  supportingStats: {
    winRate: number;
    netPnlPct: number;
    sampleSize: number;
    shadowAccuracyPct: number;
  };
  humanApprovalRequired: true;
  status: "PENDING" | "APPROVED" | "REJECTED" | "APPLIED";
  createdAt: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
}

export interface ExperimentAuditEntry {
  id: string;
  timestamp: string;
  experimentId: string;
  action:
    | "CREATED"
    | "STARTED"
    | "COMPLETED"
    | "FAILED"
    | "PROMOTION_CREATED"
    | "PROMOTION_APPROVED"
    | "PROMOTION_REJECTED"
    | "PROMOTION_APPLIED"
    | "ARCHIVED";
  detail: string;
  actorNote?: string;
}

export interface StrategyExperiment {
  experimentId: string;
  label: string;
  source: ExperimentSource;
  sourceRef: string;
  mode: ExperimentMode;
  status: ExperimentStatus;
  hypothesis: ExperimentHypothesis;
  variant: StrategyVariant;
  /** Shadow default — no paper unless explicitly enabled */
  openPaperPositions: boolean;
  result: ExperimentResult | null;
  shadowTrades: ShadowTradeRecord[];
  promotionProposal: ExperimentPromotionProposal | null;
  createdAt: string;
  updatedAt: string;
  safetyLabel: string;
  cannotPlaceLiveTrades: true;
  isolatedFromProduction: true;
}

export interface ExperimentLabReport {
  generatedAt: string;
  activeExperiments: StrategyExperiment[];
  completedResults: StrategyExperiment[];
  shadowTrades: ShadowTradeRecord[];
  promotionCandidates: ExperimentPromotionProposal[];
  failedHypotheses: StrategyExperiment[];
  auditLog: ExperimentAuditEntry[];
  safetyNotice: string;
  cannotPlaceLiveTrades: true;
  cannotChangeActiveWithoutApproval: true;
}

export interface CreateExperimentInput {
  source: ExperimentSource;
  sourceRef?: string;
  mode?: ExperimentMode;
  hypothesis: ExperimentHypothesis;
  variant: StrategyVariant;
  openPaperPositions?: boolean;
}

export interface RunExperimentInput {
  experimentId: string;
  entries: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  orders?: import("@/lib/paper/paper-order-types").PaperOrder[];
}

export interface PromoteExperimentInput {
  proposalId: string;
  action: "approve" | "reject" | "apply";
  reviewerNote?: string;
  registry?: import("@/lib/strategy-registry/strategy-registry-types").StrategySkill[];
}
