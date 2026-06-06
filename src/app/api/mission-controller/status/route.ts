import { NextResponse } from "next/server";
import {
  evaluateMissionController,
  MISSION_CONTROLLER_SAFETY_NOTICE,
} from "@/lib/mission-controller";
import { loadCalibrationStore } from "@/lib/confidence-calibration/calibration-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 78 — AI mission controller status ($1k → $10k operating mode). */
export async function GET() {
  try {
    await loadCalibrationStore().catch(() => null);
    const controller = await evaluateMissionController();
    const calibrationStore = await loadCalibrationStore().catch(() => null);
    return NextResponse.json({
      ok: true,
      mvp: 78,
      safetyNotice: MISSION_CONTROLLER_SAFETY_NOTICE,
      controller,
      calibration: calibrationStore?.profile
        ? {
            headline: calibrationStore.profile.headline,
            recommendedSizeMultiplier: calibrationStore.profile.recommendedSizeMultiplier,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mission controller failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
