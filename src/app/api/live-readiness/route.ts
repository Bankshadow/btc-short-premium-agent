import { buildLiveReadinessReport } from "@/lib/live-readiness/build-readiness-report";
import { buildServerReadinessContext } from "@/lib/live-readiness/server-context";
import { LIVE_READINESS_SAFETY_NOTICE } from "@/lib/live-readiness/thresholds";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const serverContext = await buildServerReadinessContext();
    const report = buildLiveReadinessReport({
      entries: [],
      orders: [],
      riskProfile: "balanced",
      serverContext,
    });

    return NextResponse.json({
      ok: true,
      serverContext,
      report,
      cannotEnableLive: true,
      cannotPlaceTrades: true,
      safetyNotice: LIVE_READINESS_SAFETY_NOTICE,
      hint: "Merge serverContext with client journal via buildLiveReadinessReport, or POST /api/live-readiness/report for export.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Live readiness check failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
