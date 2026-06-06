import { buildAiStatusCardState } from "@/lib/ai-status/build-card-state";
import { loadAiStatusEvents } from "@/lib/ai-status/event-store";
import { getLoopGuardDashboardSnapshot } from "@/lib/autopilot-loop-guard/run-guard";
import { getDailySelfReviewStatus } from "@/lib/daily-self-review/run-daily-self-review";
import { evaluateMissionController } from "@/lib/mission-controller/evaluate-mission-controller";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { getParallelTaskRunnerSnapshot } from "@/lib/parallel-task-runner/run-parallel-review";
import { getSecondBrainDashboardSnapshot } from "@/lib/second-brain/prepare-cycle";
import { resolveOneButtonAiState } from "./resolve-next-action";
import type { OneButtonAiStatus } from "./types";
import { ONE_BUTTON_AI_SAFETY_NOTICE } from "./types";

function isDailyReviewDue(lastRunAt: string | null): boolean {
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt);
  const now = new Date();
  return (
    last.getUTCFullYear() !== now.getUTCFullYear() ||
    last.getUTCMonth() !== now.getUTCMonth() ||
    last.getUTCDate() !== now.getUTCDate()
  );
}

export async function buildOneButtonAiStatus(
  workspaceId = "server-default",
): Promise<OneButtonAiStatus> {
  const [flow, controller, events, loopGuard, parallel, brain, dailyStatus] =
    await Promise.all([
      buildMissionFlowServerSnapshot({ fresh: true }),
      evaluateMissionController().catch(() => null),
      loadAiStatusEvents(30).catch(() => []),
      getLoopGuardDashboardSnapshot(workspaceId).catch(() => null),
      getParallelTaskRunnerSnapshot(workspaceId).catch(() => null),
      getSecondBrainDashboardSnapshot(workspaceId).catch(() => null),
      getDailySelfReviewStatus(workspaceId).catch(() => null),
    ]);

  const aiCard = buildAiStatusCardState({
    events,
    loopGuard,
    committee: parallel?.lastRun
      ? {
          committee: parallel.lastRun.committee,
          reviews: parallel.lastRun.reviews,
          completedAt: parallel.lastRun.completedAt,
        }
      : null,
    memorySummary: brain?.summary ?? null,
    permissionNeeded: flow.snapshot.aiStatus.humanActionRequired,
    permissionReason: flow.snapshot.aiStatus.nextAction,
  });

  const { state, blockers } = resolveOneButtonAiState({
    mission: flow.snapshot,
    controller,
    aiCard,
    dailyReviewDue: isDailyReviewDue(dailyStatus?.lastRunAt ?? null),
  });

  return {
    generatedAt: new Date().toISOString(),
    state,
    blockers,
    safetyNotice: ONE_BUTTON_AI_SAFETY_NOTICE,
  };
}
