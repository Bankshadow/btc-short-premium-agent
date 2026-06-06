import { NextResponse } from "next/server";
import { runGarageBacktest, STRATEGY_GARAGE_SAFETY_NOTICE } from "@/lib/strategy-garage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 81 — run simulation backtest for garage strategy. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sourceId?: string;
      symbol?: "BTCUSDT" | "SOLUSDT";
      lookbackDays?: number;
    };
    if (!body.sourceId?.trim()) {
      return NextResponse.json({ ok: false, error: "sourceId required" }, { status: 400 });
    }
    const result = await runGarageBacktest({
      sourceId: body.sourceId,
      symbol: body.symbol,
      lookbackDays: body.lookbackDays,
    });
    return NextResponse.json({
      mvp: 81,
      safetyNotice: STRATEGY_GARAGE_SAFETY_NOTICE,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backtest failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
