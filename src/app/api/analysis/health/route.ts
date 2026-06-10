import { NextResponse } from "next/server";
import { buildAnalysisEngineHealthSnapshot } from "@/lib/analysis-engine-health/build-engine-health";
import { buildCombinedEngineStatus } from "@/lib/engine-consistency/build-combined-engine-status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [snapshot, combined] = await Promise.all([
      buildAnalysisEngineHealthSnapshot(),
      buildCombinedEngineStatus(),
    ]);
    return NextResponse.json({
      ok: true,
      snapshot,
      combined,
      liveTradingLocked: true,
    });
  } catch (error) {    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Engine health check failed",
      },
      { status: 500 },
    );
  }
}
