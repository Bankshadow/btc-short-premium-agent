import { NextResponse } from "next/server";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await buildMissionFlowServerSnapshot();
    return NextResponse.json({
      ok: true,
      snapshot,
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
