import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import { buildStrategyRegistry } from "@/lib/strategy-registry/build-strategy-registry";
import { runAdaptationAnalysis } from "@/lib/strategy-adaptation/run-adaptation-analysis";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile?: "balanced" | "aggressive";
  historicalBacktest?: import("@/lib/historical-backtest/types").BacktestAdaptationBridge | null;
};

export async function POST(request: Request) {
  try {
    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      /* empty */
    }

    const entries = body.entries ?? [];
    const orders = body.orders ?? [];
    const riskProfile = body.riskProfile ?? "balanced";

    const registry = buildStrategyRegistry({ entries, orders, riskProfile });
    const result = runAdaptationAnalysis({
      entries,
      orders,
      perpPositions: body.perpPositions ?? [],
      riskProfile,
      registry,
      historicalBacktest: body.historicalBacktest ?? null,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      autoApply: false,
      liveExecutionBlocked: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Adaptation analyze failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
