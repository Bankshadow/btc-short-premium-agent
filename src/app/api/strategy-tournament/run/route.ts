import { NextResponse } from "next/server";
import { DEFAULT_QUANT_FRICTION } from "@/lib/quant-backtest/friction";
import { runStrategyTournament } from "@/lib/strategy-tournament/run-tournament";
import { TOURNAMENT_CONTESTANTS } from "@/lib/strategy-tournament/contestants";
import { TOURNAMENT_SAFETY_NOTICE } from "@/lib/strategy-tournament/types";
import type { TournamentInput } from "@/lib/strategy-tournament/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<TournamentInput>;
    const symbol = body.symbol === "SOLUSDT" ? "SOLUSDT" : "BTCUSDT";
    const timeframe =
      body.timeframe === "1h" || body.timeframe === "1d" ? body.timeframe : "4h";
    const startDate = body.startDate ?? "2024-06-01T00:00:00.000Z";
    const endDate = body.endDate ?? new Date().toISOString();
    const friction = {
      feeBps: body.friction?.feeBps ?? DEFAULT_QUANT_FRICTION.feeBps,
      slippageBps: body.friction?.slippageBps ?? DEFAULT_QUANT_FRICTION.slippageBps,
      spreadBps: body.friction?.spreadBps ?? DEFAULT_QUANT_FRICTION.spreadBps,
    };

    const result = await runStrategyTournament({
      symbol,
      timeframe,
      startDate,
      endDate,
      friction,
    });

    return NextResponse.json({
      ok: true,
      mvp: 68,
      result,
      cannotCreateOrders: true,
      cannotPromoteTestnetWithoutApproval: true,
      safetyNotice: TOURNAMENT_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Strategy tournament failed";
    return NextResponse.json(
      { ok: false, error: message, safetyNotice: TOURNAMENT_SAFETY_NOTICE },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    mvp: 68,
    analysisOnly: true,
    cannotCreateOrders: true,
    contestants: TOURNAMENT_CONTESTANTS,
    symbols: ["BTCUSDT", "SOLUSDT"],
    timeframes: ["1h", "4h", "1d"],
    defaultFriction: DEFAULT_QUANT_FRICTION,
    safetyNotice: TOURNAMENT_SAFETY_NOTICE,
    clientHint: "Open /strategy-lab/tournament to rank imported strategies.",
  });
}
