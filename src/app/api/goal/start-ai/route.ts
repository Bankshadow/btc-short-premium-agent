import { NextResponse } from "next/server";
import { runGoalStartAiCycle } from "@/lib/goal-engine/run-start-ai-cycle";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const cycle = await runGoalStartAiCycle();
    const snapshot = await buildMissionFlowServerSnapshot();

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
