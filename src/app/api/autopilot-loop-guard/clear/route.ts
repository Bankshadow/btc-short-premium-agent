import { NextResponse } from "next/server";
import {
  clearLoopGuardBlocker,
  getLoopGuardDashboardSnapshot,
} from "@/lib/autopilot-loop-guard/run-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 73 — operator clears stuck loop blocker after review. */
export async function POST() {
  try {
    await clearLoopGuardBlocker();
    const snapshot = await getLoopGuardDashboardSnapshot();
    return NextResponse.json({
      ok: true,
      message: "Loop guard blocker cleared — autopilot may resume on next cycle.",
      ...snapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clear failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
