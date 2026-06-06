import { NextResponse } from "next/server";
import {
  loadMissionRiskSettings,
  saveMissionRiskSettings,
} from "@/lib/mission-risk/mission-risk-store";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await loadMissionRiskSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load mission risk settings";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { deskRiskProfile?: DeskRiskProfile };
    if (
      body.deskRiskProfile &&
      body.deskRiskProfile !== "balanced" &&
      body.deskRiskProfile !== "aggressive"
    ) {
      return NextResponse.json(
        { ok: false, error: "deskRiskProfile must be balanced or aggressive" },
        { status: 400 },
      );
    }
    const settings = await saveMissionRiskSettings({
      deskRiskProfile: body.deskRiskProfile,
    });
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save mission risk settings";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
