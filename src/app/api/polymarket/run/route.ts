import { runPolymarketCycle } from "@/lib/polymarket/run-cycle";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await runPolymarketCycle();
    return NextResponse.json({
      ok: true,
      realTradingEnabled: false,
      paperOnly: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Cycle failed" },
      { status: 500 },
    );
  }
}
