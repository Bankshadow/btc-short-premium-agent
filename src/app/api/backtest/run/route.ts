import {
  runHistoricalBacktest,
  saveBacktestResult,
} from "@/lib/historical-backtest";
import type { RunBacktestInput } from "@/lib/historical-backtest/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RunBacktestInput;
    const result = runHistoricalBacktest(body);
    saveBacktestResult(result);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backtest failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
