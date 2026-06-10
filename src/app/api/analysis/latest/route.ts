import { NextResponse } from "next/server";
import {
  loadLatestCentralAnalysisResult,
  loadCentralAnalysisState,
  stripAnalysisResultForClient,
  toAnalysisUiView,
} from "@/lib/analysis-engine/analysis-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [state, latest] = await Promise.all([
      loadCentralAnalysisState(),
      loadLatestCentralAnalysisResult(),
    ]);

    if (!latest) {
      return NextResponse.json({
        ok: true,
        result: null,
        ui: toAnalysisUiView({ state, result: null }),
        liveTradingLocked: true,
      });
    }

    return NextResponse.json({
      ok: true,
      result: stripAnalysisResultForClient(latest),
      ui: toAnalysisUiView({ state, result: latest }),
      liveTradingLocked: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Latest analysis failed",
      },
      { status: 500 },
    );
  }
}
