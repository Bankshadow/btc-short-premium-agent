import { NextResponse } from "next/server";
import { buildGoalTradeListServer } from "@/lib/goal-engine/build-server-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const trades = await buildGoalTradeListServer();
    return NextResponse.json({ ok: true, trades });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trades failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
