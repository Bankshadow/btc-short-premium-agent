import type {
  CapitalAllocationRecommendation,
  StrategyId,
} from "@/lib/validation/validation-types";

export type CouncilCommitteeDecision =
  | "APPROVE_FOR_PAPER_TEST"
  | "REJECT"
  | "NEED_MORE_DATA"
  | "PROMOTE_TO_ACTIVE"
  | "DEMOTE_TO_PAPER_ONLY"
  | "DISABLE_STRATEGY";

export type CouncilProposalStatus =
  | "DRAFT"
  | "APPROVED_FOR_PAPER"
  | "REJECTED"
  | "NEED_MORE_DATA"
  | "PROMOTED"
  | "DISABLED";

export type CouncilTestMode = "paper_only" | "shadow_log" | "replay_backtest";

export interface CouncilProposal {
  id: string;
  title: string;
  targetStrategy: StrategyId | "desk" | "multi";
  problemObserved: string;
  proposedChange: string;
  expectedBenefit: string;
  riskConcern: string;
  requiredSampleSize: number;
  testMode: CouncilTestMode;
  status: CouncilProposalStatus;
  linkedDraftRuleHint?: string;
}

export interface CouncilAgentDebateRow {
  agentName: string;
  role: string;
  stance: "support" | "challenge" | "neutral";
  statements: string[];
}

export interface CouncilGoalStatus {
  currentEquityUsd: number;
  startingCapitalUsd: number;
  goalCapitalUsd: number;
  stageLabel: string;
  nextMilestoneUsd: number | null;
  distanceToNextUsd: number | null;
  distanceToGoalUsd: number;
  progressToGoalPct: number;
  paceAssessment: string;
  bottleneck: string;
}

export interface CouncilRiskReviewItem {
  proposalId: string;
  drawdownRisk: string;
  overfittingRisk: string;
  sampleSizeWeakness: string;
  recommendation: "approve_paper" | "reject" | "need_more_data";
  summary: string;
}

export interface CouncilRiskReview {
  hardRulesLocked: true;
  noLiveExecution: true;
  noAutoPositionIncrease: true;
  items: CouncilRiskReviewItem[];
  globalWarnings: string[];
}

export interface CouncilCommitteeOutcome {
  decision: CouncilCommitteeDecision;
  proposalDecisions: Array<{
    proposalId: string;
    decision: CouncilCommitteeDecision;
    rationale: string;
  }>;
  summary: string;
}

export interface CouncilSessionResult {
  councilSessionId: string;
  timestamp: string;
  topic: string;
  goalStatus: CouncilGoalStatus;
  agentDebate: CouncilAgentDebateRow[];
  proposals: CouncilProposal[];
  riskReview: CouncilRiskReview;
  capitalRecommendation: CapitalAllocationRecommendation & {
    councilNote: string;
    aggressiveIncreaseBlocked: boolean;
  };
  committeeDecision: CouncilCommitteeOutcome;
  councilMemo: string;
  guardrails: string[];
}

export interface CouncilRunRequest {
  topic?: string;
  currentEquity?: number;
  startingCapital?: number;
  goalCapital?: number;
}

export const COUNCIL_GUARDRAILS = [
  "Hard risk rules are locked — council cannot override stale data, daily loss, or data-quality locks.",
  "No live exchange execution — proposals are advisory and paper-first only.",
  "Draft rules never affect live committee decisions without human approval.",
  "All proposals start as DRAFT — promotion requires operator action on /council.",
  "AI cannot increase position size or enable aggressive mode automatically.",
] as const;
