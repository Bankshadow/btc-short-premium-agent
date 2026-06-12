import { runPolymarketCycle } from "@/lib/polymarket/run-cycle";
import { buildTerminalBundle } from "@/lib/terminal/terminal-projection-builder";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Paper-only refresh: Polymarket + sweeper scan. No execution endpoints. */
export async function POST() {
  try {
    await runPolymarketCycle();
    const bundle = await buildTerminalBundle();
    return NextResponse.json({
      ok: true,
      paperOnly: true,
      realTradingEnabled: false,
      message: "Polymarket paper scan completed.",
      bundle,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Terminal refresh failed" },
      { status: 500 },
    );
  }
}
