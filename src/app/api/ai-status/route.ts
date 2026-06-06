import { NextResponse } from "next/server";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { AI_STATUS_SAFETY_NOTICE } from "@/lib/ai-status/types";
import { buildAiStatusCardState } from "@/lib/ai-status/build-card-state";
import { loadAiStatusEvents, getActiveAiRunId } from "@/lib/ai-status/event-store";
import { getLoopGuardDashboardSnapshot } from "@/lib/autopilot-loop-guard/run-guard";
import { getSecondBrainDashboardSnapshot } from "@/lib/second-brain/prepare-cycle";
import { getParallelTaskRunnerSnapshot } from "@/lib/parallel-task-runner/run-parallel-review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 72 + 73 — real-time AI status card snapshot (polling). */
export async function GET() {
  try {
    const [events, mission, loopGuard, secondBrain, parallelRunner] = await Promise.all([
      loadAiStatusEvents(30),
      buildMissionFlowServerSnapshot().catch(() => null),
      getLoopGuardDashboardSnapshot().catch(() => null),
      getSecondBrainDashboardSnapshot().catch(() => null),
      getParallelTaskRunnerSnapshot().catch(() => null),
    ]);

    const snapshot = mission?.snapshot;
    const card = buildAiStatusCardState({
      events,
      activeRunId: getActiveAiRunId(),
      permissionNeeded: snapshot?.aiStatus.humanActionRequired ?? false,
      permissionReason: snapshot?.pendingTestnetPreview?.blocked
        ? snapshot.pendingTestnetPreview.blockReasons[0] ?? null
        : snapshot?.aiStatus.humanActionRequired
          ? "Operator approval required for testnet action"
          : null,
      estimatedNextAction: snapshot?.aiStatus.nextAction ?? undefined,
      loopGuard: loopGuard
        ? {
            blocker: loopGuard.blocker,
            decision: loopGuard.decision,
            selfCheckSummary: loopGuard.lastSelfCheckSummary,
          }
        : null,
      memorySummary: secondBrain?.summary ?? null,
      committee: parallelRunner?.lastRun
        ? {
            committee: parallelRunner.lastRun.committee,
            reviews: parallelRunner.lastRun.reviews,
            completedAt: parallelRunner.lastRun.completedAt,
          }
        : null,
    });

    return NextResponse.json({
      ok: true,
      mvp: 74,
      liveLocked: true,
      safetyNotice: AI_STATUS_SAFETY_NOTICE,
      card,
      events: events.slice(0, 20),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
