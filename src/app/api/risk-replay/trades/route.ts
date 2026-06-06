import { NextResponse } from "next/server";
import { listRiskReplayTrades } from "@/lib/risk-replay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const trades = await listRiskReplayTrades();
    return NextResponse.json({ ok: true, trades });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Risk replay trade list failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
