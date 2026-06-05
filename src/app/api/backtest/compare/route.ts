import {
  compareBacktestScenarios,
  saveBacktestComparison,
  saveBacktestResult,
} from "@/lib/historical-backtest";
import type { BacktestScenario } from "@/lib/historical-backtest/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      entries: DecisionLogEntry[];
      orders?: PaperOrder[];
      baseline: BacktestScenario;
      proposed: BacktestScenario;
    };

    const compare = compareBacktestScenarios(body);
    saveBacktestResult(compare.baseline);
    saveBacktestResult(compare.proposed);
    saveBacktestComparison(compare);

    return NextResponse.json({ ok: true, compare });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Compare failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
