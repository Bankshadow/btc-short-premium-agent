import { NextResponse } from "next/server";
import { runStrategyShadowMode } from "@/lib/strategy-shadow/run-shadow-cycle";
import { buildStrategyShadowReport } from "@/lib/strategy-shadow/build-report";
import { STRATEGY_SHADOW_SAFETY_NOTICE } from "@/lib/strategy-shadow/types";
import type { RunShadowInput } from "@/lib/strategy-shadow/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 70 — run shadow replay for imported strategies + AI committee. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<RunShadowInput>;
    const symbol = body.symbol === "SOLUSDT" ? "SOLUSDT" : "BTCUSDT";
    const lookbackDays = Number(body.lookbackDays ?? 90);
    const mode = body.mode === "forward" ? "forward" : "replay";

    const run = await runStrategyShadowMode({
      symbol,
      lookbackDays: Number.isFinite(lookbackDays) ? lookbackDays : 90,
      mode,
      includeRejected: body.includeRejected ?? false,
    });

    const report = await buildStrategyShadowReport({
      symbol,
      lookbackDays,
      aiPaperOrders: run.aiPaperOrders,
    });

    return NextResponse.json({
      ok: true,
      mvp: 70,
      neverPlacesOrders: true,
      cannotCountAsLiveProof: true,
      executionBlocked: true,
      safetyNotice: STRATEGY_SHADOW_SAFETY_NOTICE,
      quantTradeCount: run.quantTrades.length,
      aiTradeCount: run.aiTrades.length,
      report,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Strategy shadow run failed";
    return NextResponse.json(
      { ok: false, error: message, safetyNotice: STRATEGY_SHADOW_SAFETY_NOTICE },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    mvp: 70,
    neverPlacesOrders: true,
    cannotCountAsLiveProof: true,
    symbols: ["BTCUSDT", "SOLUSDT"],
    defaultLookbackDays: 90,
    safetyNotice: STRATEGY_SHADOW_SAFETY_NOTICE,
    clientHint: "Open /strategy-lab/shadow to evaluate strategies before testnet.",
  });
}
