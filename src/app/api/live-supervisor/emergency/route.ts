import { buildEmergencyTriggerResponse } from "@/lib/live-trade-supervisor/trigger-emergency";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      operatorNote?: string;
      triggerGovernanceKillSwitch?: boolean;
    };

    const result = buildEmergencyTriggerResponse(body);

    return NextResponse.json({
      ok: true,
      ...result,
      clientMustPersist: true,
      cannotAutoClose: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Emergency failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
