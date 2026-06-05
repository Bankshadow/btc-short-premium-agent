import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { PaperMode } from "@/lib/paper/paper-relaxed-types";
import type { StrategyId } from "@/lib/validation/validation-types";
import type { StrategySkill } from "@/lib/strategy-registry/strategy-registry-types";

export type AdaptationProposalType =
  | "PROMOTE"
  | "DEMOTE"
  | "PAUSE"
  | "TIGHTEN_RULE"
  | "RELAX_RULE"
  | "REVIEW_ONLY";

export type AdaptationProposalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "APPLIED"
  | "REVERTED";

export interface AdaptationSupportingStats {
  winRate: number;
  avgPnlPct: number;
  maxDrawdownPct: number;
  sampleSize: number;
  regimeLabel?: string;
  assetLabel?: string;
  strictVsRelaxedDelta?: number;
  failureStreak?: number;
  agentAccuracyPct?: number;
}

export interface StrategyAdaptationProposal {
  proposalId: string;
  type: AdaptationProposalType;
  targetStrategy: StrategyId;
  reason: string;
  supportingStats: AdaptationSupportingStats;
  riskImpact: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  expectedBehaviorChange: string;
  humanApprovalRequired: true;
  status: AdaptationProposalStatus;
  createdAt: string;
  reviewedAt: string | null;
  appliedAt: string | null;
  reviewerNote: string | null;
  editedReason: string | null;
  previousRegistryStatus: StrategySkill["status"] | null;
  proposedRegistryStatus: StrategySkill["status"] | null;
}

export interface StrategyPerformanceSlice {
  strategyId: StrategyId;
  label: string;
  winRate: number;
  avgPnlPct: number;
  maxDrawdownPct: number;
  sampleSize: number;
  totalPnlUsd: number;
  currentStatus: StrategySkill["status"];
}

export interface RegimePerformanceSlice {
  regime: string;
  winRate: number;
  avgPnlPct: number;
  sampleSize: number;
  bestStrategy: StrategyId | null;
  worstStrategy: StrategyId | null;
}

export interface AgentAccuracySlice {
  agentName: string;
  accuracyPct: number;
  totalCalls: number;
  falsePositives: number;
  falseNegatives: number;
}

export interface StrictRelaxedComparison {
  strict: { trades: number; winRate: number; avgPnlPct: number };
  relaxed: { trades: number; winRate: number; avgPnlPct: number };
}

export interface FailurePattern {
  pattern: string;
  count: number;
  strategies: StrategyId[];
  regimes: string[];
}

export interface AdaptationPerformanceReport {
  generatedAt: string;
  riskProfile: DeskRiskProfile;
  paperModeSummary: Record<PaperMode, number>;
  strategyPerformance: StrategyPerformanceSlice[];
  regimePerformance: RegimePerformanceSlice[];
  agentAccuracy: AgentAccuracySlice[];
  strictVsRelaxed: StrictRelaxedComparison;
  failurePatterns: FailurePattern[];
  /** MVP 36 — latest historical backtest summary (simulation only) */
  historicalBacktest?: import("@/lib/historical-backtest/types").BacktestAdaptationBridge | null;
}

export interface AdaptationAnalysisResult {
  report: AdaptationPerformanceReport;
  proposals: StrategyAdaptationProposal[];
  safetyNotice: string;
}

export interface AdaptationAuditEntry {
  id: string;
  timestamp: string;
  proposalId: string;
  action:
    | "CREATED"
    | "APPROVED"
    | "REJECTED"
    | "EDITED"
    | "APPLIED"
    | "REVERTED";
  operatorNote: string;
  targetStrategy: StrategyId;
  proposalType: AdaptationProposalType;
  beforeStatus: StrategySkill["status"] | null;
  afterStatus: StrategySkill["status"] | null;
  reversible: boolean;
}

export interface AdaptationApplyInput {
  proposalId: string;
  action: "approve" | "reject" | "edit" | "apply" | "revert";
  operatorNote?: string;
  editedReason?: string;
  proposal: StrategyAdaptationProposal;
  registry: { strategies: StrategySkill[] };
}

export interface AdaptationApplyResult {
  ok: boolean;
  error?: string;
  proposal?: StrategyAdaptationProposal;
  auditEntry?: AdaptationAuditEntry;
  registryPatch?: {
    strategyId: StrategyId;
    status: StrategySkill["status"];
    statusLocked: boolean;
    versionNote: string;
  };
}
