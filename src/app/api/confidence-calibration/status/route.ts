import { NextResponse } from "next/server";
import { getConfidenceCalibrationStatus } from "@/lib/confidence-calibration/run-calibration-update";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 83 — confidence calibration bucket performance. */
export async function GET() {
  try {
    const status = await getConfidenceCalibrationStatus();
    return NextResponse.json({
      ok: true,
      mvp: 83,
      status,
      executionBlocked: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
