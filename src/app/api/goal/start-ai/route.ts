import { NextResponse } from "next/server";
import { buildGoalDashboardServerPayload } from "@/lib/goal-engine/build-server-context";
import { runGoalStartAiCycle } from "@/lib/goal-engine/run-start-ai-cycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const cycle = await runGoalStartAiCycle();
    const payload = await buildGoalDashboardServerPayload();

    return NextResponse.json({
      ok: true,
      cycle: {
        deskRunId: cycle.deskRun.runId,
        journalStatus: cycle.journalStatus,
        verdict: cycle.journalEntry.finalVerdict,
        aiStatus: cycle.autopilot.status,
        testnetPreviewId: cycle.testnetPreview?.previewId ?? null,
        testnetConnected: cycle.testnetConnected,
      },
      ...payload,
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
