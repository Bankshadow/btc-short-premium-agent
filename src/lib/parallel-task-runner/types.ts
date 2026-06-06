import type { OperatorAction } from "@/lib/operator-action-queue/types";

export const PARALLEL_TASK_RUNNER_SAFETY_NOTICE =
  "Parallel reviews are advisory only — order execution stays serialized, permissioned, and never runs in parallel.";

export type ParallelAgentRole =
  | "STRATEGY"
  | "RISK"
  | "UX"
  | "EXECUTION"
  | "LEARNING"
  | "PROJECT_STRATEGIST";

export type ParallelReviewStatus = "OK" | "WARNING" | "CRITICAL" | "SKIPPED";

export type CommitteeRecommendation =
  | "CONTINUE"
  | "PAUSE_AND_REVIEW"
  | "IMPLEMENT_FOLLOW_UP";

export interface ParallelAgentReview {
  role: ParallelAgentRole;
  agentName: string;
  status: ParallelReviewStatus;
  headline: string;
  findings: string[];
  risks: string[];
  recommendations: string[];
  durationMs: number;
  error: string | null;
}

export interface CommitteeModeratorResult {
  generatedAt: string;
  recommendation: CommitteeRecommendation;
  summary: string;
  topReasons: string[];
  dissent: string[];
  actionItems: OperatorAction[];
  cursorPrompt: string | null;
  cursorPromptApproved: boolean;
  executionSerialized: true;
  parallelOrderExecutionBlocked: true;
}

export interface ParallelTaskRunResult {
  runId: string;
  workspaceId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  reviews: ParallelAgentReview[];
  committee: CommitteeModeratorResult;
  safetyNotice: string;
}

export interface ParallelTaskRunnerState {
  workspaceId: string;
  lastRun: ParallelTaskRunResult | null;
  totalRuns: number;
  updatedAt: string;
}
