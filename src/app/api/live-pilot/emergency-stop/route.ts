import { loadLivePilotRiskConfig } from "@/lib/live-pilot/pilot-config";
import { PILOT_SAFETY_NOTICE } from "@/lib/live-pilot/pilot-mode";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { active: boolean; operatorNote?: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const config = loadLivePilotRiskConfig();

    return NextResponse.json({
      ok: true,
      emergencyStopActive: body.active === true,
      envEmergencyStop: config.emergencyStopEnv,
      operatorNote: body.operatorNote ?? "",
      clientMustPersist: true,
      safetyNotice:
        "Emergency stop is persisted in browser localStorage. Set PILOT_EMERGENCY_STOP=true on server for env-level stop.",
      cannotEnablePilot: true,
      pilotNotice: PILOT_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Emergency stop failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
