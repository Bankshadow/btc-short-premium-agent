import { closePilotPerpPosition } from "@/lib/live-pilot/pilot-execution";
import type { PilotCloseInput } from "@/lib/live-pilot/pilot-execution";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PilotCloseInput;

    if (!body.liveTradeId || !body.symbol || !body.qty) {
      return NextResponse.json(
        { error: "liveTradeId, symbol, qty required" },
        { status: 400 },
      );
    }

    const result = await closePilotPerpPosition(body);
    return NextResponse.json(
      { ...result, clientMustPersistJournal: true },
      { status: result.ok ? 200 : 422 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pilot close failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
