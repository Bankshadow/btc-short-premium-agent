import { runPolymarketSweeperCycle } from "@/lib/polymarket/run-sweeper-cycle";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await runPolymarketSweeperCycle();
    return NextResponse.json({
      ok: true,
      realTradingEnabled: false,
      paperOnly: true,
      noWalletSigning: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Sweeper scan failed" },
      { status: 500 },
    );
  }
}
