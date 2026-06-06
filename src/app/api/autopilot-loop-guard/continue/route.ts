import { NextResponse } from "next/server";
import {
  grantSuspiciousLoopPermission,
  getLoopGuardDashboardSnapshot,
} from "@/lib/autopilot-loop-guard/run-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 73 — operator approves continuing after suspicious loop self-check. */
export async function POST() {
  try {
    await grantSuspiciousLoopPermission();
    const snapshot = await getLoopGuardDashboardSnapshot();
    return NextResponse.json({
      ok: true,
      message: "Suspicious loop cleared — one autopilot cycle may continue.",
      ...snapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Continue failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
