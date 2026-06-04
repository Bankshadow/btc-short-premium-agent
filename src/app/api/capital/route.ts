import { capitalMissionMeta } from "@/lib/capital/build-capital-report";
import { MISSION_STAGE_FLOORS_USD } from "@/lib/capital/capital-mission-config";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** MVP 12 — mission ladder metadata (full report is client-built from local log). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ...capitalMissionMeta(),
    scaleRules: {
      minSignalsWatchlist: VALIDATION_THRESHOLDS.minSignalsWatchlist,
      minSignalsForActive: VALIDATION_THRESHOLDS.minSignalsForActive,
      avgRDisable: VALIDATION_THRESHOLDS.avgRDisable,
      maxDrawdownWatchPct: VALIDATION_THRESHOLDS.maxDrawdownWatchPct,
      portfolioMaxDrawdownPct: VALIDATION_THRESHOLDS.portfolioMaxDrawdownPct,
      maxOperatorOverrides7d: 3,
    },
    stages: MISSION_STAGE_FLOORS_USD.map((floor, i) => ({
      floorUsd: floor,
      nextUsd: MISSION_STAGE_FLOORS_USD[i + 1] ?? null,
    })),
    clientReportHint:
      "Open /capital in the browser to build the full report from decision log + paper orders.",
  });
}
