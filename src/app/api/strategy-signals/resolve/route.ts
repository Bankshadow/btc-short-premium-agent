import { NextResponse } from "next/server";
import { resolveApprovedStrategySignals } from "@/lib/strategy-signals/resolve-approved-signals";
import { STRATEGY_SIGNAL_SAFETY_NOTICE } from "@/lib/strategy-signals/types";
import type { QuantBacktestSymbol } from "@/lib/quant-backtest/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 69 — resolve live advisory signals from approved quant imports. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get("symbol") ?? "BTCUSDT") as QuantBacktestSymbol;
    const lookbackDays = Number(searchParams.get("lookbackDays") ?? "90");

    const signals = await resolveApprovedStrategySignals({
      symbol,
      lookbackDays: Number.isFinite(lookbackDays) ? lookbackDays : 90,
    });

    return NextResponse.json({
      ok: true,
      mvp: 69,
      advisoryOnly: true,
      executionBlocked: true,
      cannotBypassRiskVeto: true,
      cannotAutoExecute: true,
      cannotEnableLive: true,
      safetyNotice: STRATEGY_SIGNAL_SAFETY_NOTICE,
      approvedCount: signals.length,
      signals,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve strategy signals";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
