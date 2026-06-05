import { buildPilotStatusSnapshot } from "@/lib/live-pilot/build-pilot-status";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  journal?: LiveTradeJournalEntry[];
  emergencyStopActive?: boolean;
};

export async function GET() {
  try {
    const status = buildPilotStatusSnapshot([], false);
    return NextResponse.json({
      ok: true,
      status,
      cannotEnablePilot: true,
      cannotPlaceTrades: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pilot status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      /* empty */
    }
    const status = buildPilotStatusSnapshot(
      body.journal ?? [],
      body.emergencyStopActive ?? false,
    );
    return NextResponse.json({
      ok: true,
      status,
      cannotEnablePilot: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pilot status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
