import { NextResponse } from "next/server";
import { runStrategyShadowMode } from "@/lib/strategy-shadow/run-shadow-cycle";
import { buildStrategyShadowReport } from "@/lib/strategy-shadow/build-report";
import { upsertGarageRecord } from "@/lib/strategy-garage/garage-store";
import { STRATEGY_GARAGE_SAFETY_NOTICE } from "@/lib/strategy-garage/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 81 — run shadow replay for garage strategy (no orders). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sourceId?: string; lookbackDays?: number };
    if (!body.sourceId?.trim()) {
      return NextResponse.json({ ok: false, error: "sourceId required" }, { status: 400 });
    }
    const lookbackDays = body.lookbackDays ?? 90;
    const run = await runStrategyShadowMode({
      symbol: "BTCUSDT",
      lookbackDays,
      mode: "replay",
    });
    const report = await buildStrategyShadowReport({
      symbol: "BTCUSDT",
      lookbackDays,
      aiPaperOrders: run.aiPaperOrders,
    });
    await upsertGarageRecord(body.sourceId, { stage: "SHADOW_TESTING" });
    return NextResponse.json({
      ok: true,
      mvp: 81,
      safetyNotice: STRATEGY_GARAGE_SAFETY_NOTICE,
      quantTradeCount: run.quantTrades.length,
      report,
      executionBlocked: true,
      neverPlacesOrders: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shadow run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
