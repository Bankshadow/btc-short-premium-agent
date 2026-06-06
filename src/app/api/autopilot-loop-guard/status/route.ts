import { NextResponse } from "next/server";
import { LOOP_GUARD_SAFETY_NOTICE } from "@/lib/autopilot-loop-guard/types";
import { getLoopGuardDashboardSnapshot } from "@/lib/autopilot-loop-guard/run-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 73 — loop guard metrics and blocker snapshot. */
export async function GET() {
  try {
    const snapshot = await getLoopGuardDashboardSnapshot();
    return NextResponse.json({
      ok: true,
      mvp: 73,
      safetyNotice: LOOP_GUARD_SAFETY_NOTICE,
      ...snapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Loop guard status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
