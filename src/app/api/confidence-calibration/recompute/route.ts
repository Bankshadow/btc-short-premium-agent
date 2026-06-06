import { NextResponse } from "next/server";
import { runConfidenceCalibrationUpdate } from "@/lib/confidence-calibration/run-calibration-update";
import { CONFIDENCE_CALIBRATION_SAFETY_NOTICE } from "@/lib/confidence-calibration/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 83 — rebuild confidence calibration profile. */
export async function POST() {
  try {
    const result = await runConfidenceCalibrationUpdate();
    return NextResponse.json({
      ok: true,
      mvp: 83,
      profile: result.profile,
      samplesAdded: result.samplesAdded,
      safetyNotice: CONFIDENCE_CALIBRATION_SAFETY_NOTICE,
      executionBlocked: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recompute failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
