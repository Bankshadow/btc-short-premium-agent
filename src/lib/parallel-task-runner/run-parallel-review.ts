import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { mergeServerPendingOperatorActions } from "@/lib/automation-control-plane/state-store";
import { buildParallelReviewContext } from "./build-review-context";
import { PARALLEL_AGENT_ROLES } from "./config";
import { PARALLEL_REVIEW_RUNNERS } from "./agents/run-agent-reviews";
import { moderateCommitteeResults } from "./committee-moderator";
import { saveParallelTaskRun } from "./runner-store";
import {
  assertParallelReviewOnly,
  executionSafetyFlags,
} from "./safety";
import type { ParallelAgentReview, ParallelTaskRunResult } from "./types";
import { PARALLEL_TASK_RUNNER_SAFETY_NOTICE } from "./types";

function newRunId(): string {
  return `ptr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function runParallelAgentReview(input: {
  workspaceId?: string;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  riskProfile: DeskRiskProfile;
  approveCursorPrompt?: boolean;
  intent?: string;
}): Promise<ParallelTaskRunResult> {
  assertParallelReviewOnly(input.intent);

  const workspaceId = input.workspaceId ?? "server-default";
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const runId = newRunId();

  const ctx = await buildParallelReviewContext({
    workspaceId,
    entries: input.entries,
    orders: input.orders,
    riskProfile: input.riskProfile,
  });

  const settled = await Promise.allSettled(
    PARALLEL_AGENT_ROLES.map(async (role) => {
      const runner = PARALLEL_REVIEW_RUNNERS[role];
      return runner(ctx);
    }),
  );

  const reviews: ParallelAgentReview[] = settled.map((result, idx) => {
    const role = PARALLEL_AGENT_ROLES[idx];
    if (result.status === "fulfilled") return result.value;
    return {
      role,
      agentName: role,
      status: "SKIPPED" as const,
      headline: "Review failed",
      findings: [],
      risks: [],
      recommendations: [],
      durationMs: 0,
      error: result.reason instanceof Error ? result.reason.message : "Unknown error",
    };
  });

  const committee = moderateCommitteeResults(reviews, {
    approveCursorPrompt: input.approveCursorPrompt,
  });

  if (committee.actionItems.length > 0) {
    await mergeServerPendingOperatorActions(committee.actionItems);
  }

  const completedAt = new Date().toISOString();
  const result: ParallelTaskRunResult = {
    runId,
    workspaceId,
    startedAt,
    completedAt,
    durationMs: Date.now() - startMs,
    reviews,
    committee,
    safetyNotice: PARALLEL_TASK_RUNNER_SAFETY_NOTICE,
  };

  await saveParallelTaskRun(result);
  void executionSafetyFlags();
  return result;
}

export async function getParallelTaskRunnerSnapshot(workspaceId = "server-default") {
  const { loadParallelTaskRunnerState } = await import("./runner-store");
  const state = await loadParallelTaskRunnerState(workspaceId);
  return {
    state,
    lastRun: state.lastRun,
    committee: state.lastRun?.committee ?? null,
    reviews: state.lastRun?.reviews ?? [],
  };
}
