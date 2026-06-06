import { buildCommandCenterServerContext } from "@/lib/command-center/server-context";
import { DEFAULT_AUTOPILOT_SETTINGS, AUTOPILOT_SAFETY_NOTICE } from "@/lib/autopilot/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const serverContext = await buildCommandCenterServerContext();
    return NextResponse.json({
      ok: true,
      defaultSettings: DEFAULT_AUTOPILOT_SETTINGS,
      serverContext,
      cannotEnableLiveAutopilot: true,
      safetyNotice: AUTOPILOT_SAFETY_NOTICE,
      hint: "POST /api/autopilot/run with journal payload for full cycle.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Autopilot status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
