import { NextResponse } from "next/server";
import { buildEngineConsistencySnapshot } from "@/lib/engine-consistency/build-engine-consistency";
import { buildCombinedEngineStatus } from "@/lib/engine-consistency/build-combined-engine-status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [snapshot, combined] = await Promise.all([
      buildEngineConsistencySnapshot(),
      buildCombinedEngineStatus(),
    ]);

    return NextResponse.json({
      ok: true,
      snapshot,
      combined,
      liveTradingLocked: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Consistency check failed",
      },
      { status: 500 },
    );
  }
}
