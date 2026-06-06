import { NextResponse } from "next/server";
import { runQuantBacktest } from "@/lib/quant-backtest/run-quant-backtest";
import { DEFAULT_QUANT_FRICTION } from "@/lib/quant-backtest/friction";
import { isQuantBacktestRunnerSupported } from "@/lib/quant-backtest/signal-runners";
import { QUANT_BACKTEST_SAFETY_NOTICE } from "@/lib/quant-backtest/types";
import type { QuantBacktestInput } from "@/lib/quant-backtest/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 67 — kline quant backtest (simulation only, no orders). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<QuantBacktestInput>;
    const sourceId = body.sourceId?.trim();
    if (!sourceId) {
      return NextResponse.json(
        { ok: false, error: "sourceId is required." },
        { status: 400 },
      );
    }
    if (!isQuantBacktestRunnerSupported(sourceId)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Strategy runner not supported yet. Use MACD, RSI, Bollinger, Dual Thrust, or Heikin-Ashi imports.",
        },
        { status: 400 },
      );
    }

    const symbol = body.symbol === "SOLUSDT" ? "SOLUSDT" : "BTCUSDT";
    const timeframe =
      body.timeframe === "1h" || body.timeframe === "1d" ? body.timeframe : "4h";
    const startDate = body.startDate ?? "2024-01-01T00:00:00.000Z";
    const endDate = body.endDate ?? new Date().toISOString();
    const friction = {
      feeBps: body.friction?.feeBps ?? DEFAULT_QUANT_FRICTION.feeBps,
      slippageBps: body.friction?.slippageBps ?? DEFAULT_QUANT_FRICTION.slippageBps,
      spreadBps: body.friction?.spreadBps ?? DEFAULT_QUANT_FRICTION.spreadBps,
    };

    const result = await runQuantBacktest({
      sourceId,
      symbol,
      timeframe,
      startDate,
      endDate,
      friction,
      parameters: body.parameters,
    });

    return NextResponse.json({
      ok: true,
      mvp: 67,
      result,
      cannotCreateOrders: true,
      cannotPromoteTestnetWithoutApproval: true,
      safetyNotice: QUANT_BACKTEST_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Quant backtest failed";
    return NextResponse.json(
      {
        ok: false,
        error: message,
        cannotCreateOrders: true,
        safetyNotice: QUANT_BACKTEST_SAFETY_NOTICE,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    mvp: 67,
    analysisOnly: true,
    cannotCreateOrders: true,
    cannotPromoteTestnetWithoutApproval: true,
    supportedRunners: [
      "macd-oscillator",
      "rsi-pattern-recognition",
      "bollinger-bands-pattern",
      "dual-thrust",
      "heikin-ashi",
      "ai-desk-options-premium",
    ],
    symbols: ["BTCUSDT", "SOLUSDT"],
    timeframes: ["1h", "4h", "1d"],
    defaultFriction: DEFAULT_QUANT_FRICTION,
    safetyNotice: QUANT_BACKTEST_SAFETY_NOTICE,
    clientHint: "Open /strategy-lab/backtest to run imported strategy backtests.",
  });
}
