import { NextResponse } from "next/server";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fresh = searchParams.get("fresh") === "1";
    const result = await buildMissionFlowServerSnapshot({ fresh });
    return NextResponse.json({
      ok: true,
      snapshot: result.snapshot,
      degraded: result.degraded,
      warnings: result.warnings,
      cached: result.cached,
      safety: {
        cannotEnableLive: true,
        cannotAutoExecuteLive: true,
        testnetRequiresDoubleConfirm: true,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mission snapshot failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
