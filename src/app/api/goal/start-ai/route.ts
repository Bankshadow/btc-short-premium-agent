import { NextResponse } from "next/server";
import { runGoalStartAiCycle } from "@/lib/goal-engine/run-start-ai-cycle";
import {
  buildMissionFlowServerSnapshot,
  invalidateMissionSnapshotCache,
} from "@/lib/mission-flow/build-server-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const cycle = await runGoalStartAiCycle();
    invalidateMissionSnapshotCache();
    const { snapshot } = await buildMissionFlowServerSnapshot({ fresh: true });

    return NextResponse.json({
      ok: true,
      snapshot,
      cycle: {
        deskRunId: cycle.deskRun.runId,
        journalStatus: cycle.journalStatus,
        verdict: cycle.journalEntry.finalVerdict,
        decisionLogId: cycle.journalEntry.id,
        aiStatus: cycle.autopilot.status,
        testnetPreviewId: cycle.testnetPreview?.previewId ?? null,
        testnetPreview: cycle.testnetPreview
          ? {
              previewId: cycle.testnetPreview.previewId,
              symbol: cycle.testnetPreview.symbol,
              side: cycle.testnetPreview.side,
              notionalUsd: cycle.testnetPreview.notionalUsd,
              blocked: cycle.testnetPreview.blocked,
              expiresAt: cycle.testnetPreview.expiresAt,
            }
          : null,
        testnetConnected: cycle.testnetConnected,
      },
      safety: {
        cannotEnableLive: true,
        cannotAutoExecuteLive: true,
        testnetRequiresDoubleConfirm: true,
        testnetPreviewOnly: Boolean(cycle.testnetPreview),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Start AI cycle failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
