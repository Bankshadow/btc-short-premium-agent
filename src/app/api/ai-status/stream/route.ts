import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { buildAiStatusCardState } from "@/lib/ai-status/build-card-state";
import { loadAiStatusEvents, getActiveAiRunId } from "@/lib/ai-status/event-store";
import { getLoopGuardDashboardSnapshot } from "@/lib/autopilot-loop-guard/run-guard";
import { getSecondBrainDashboardSnapshot } from "@/lib/second-brain/prepare-cycle";
import { getParallelTaskRunnerSnapshot } from "@/lib/parallel-task-runner/run-parallel-review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 72 — SSE stream for AI status card updates. */
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
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
            permissionReason: snapshot?.aiStatus.humanActionRequired
              ? "Operator approval required"
              : null,
            estimatedNextAction: snapshot?.aiStatus.nextAction,
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
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ ok: true, card })}\n\n`),
          );
        } catch {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ ok: false })}\n\n`),
          );
        }
      };

      await send();
      const interval = setInterval(() => void send(), 3000);

      const cleanup = () => clearInterval(interval);
      // @ts-expect-error — cancel hook for stream lifecycle
      controller.signal?.addEventListener?.("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
