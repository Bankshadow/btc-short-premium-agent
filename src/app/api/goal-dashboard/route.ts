import { NextResponse } from "next/server";
import { buildGoalDashboardServerPayload } from "@/lib/goal-engine/build-server-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const payload = await buildGoalDashboardServerPayload();
    return NextResponse.json({
      ok: true,
      ...payload,
      safety: {
        cannotEnableLive: true,
        cannotAutoExecuteLive: true,
        testnetRequiresDoubleConfirm: true,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Goal dashboard failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
