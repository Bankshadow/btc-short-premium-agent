import {
  buildRiskBudgetInput,
  optimizeRiskBudget,
  applyRiskBudgetToAnalyzeResponse,
} from "@/lib/risk-budget-optimizer";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      entries: DecisionLogEntry[];
      orders: PaperOrder[];
      perpPositions?: PerpPaperPosition[];
      riskProfile?: "balanced" | "aggressive";
      analyze?: AnalyzeApiResponse | null;
      governance?: GovernanceAnalyzePayload | null;
      applyToAnalyze?: boolean;
    };

    const budgetInput = buildRiskBudgetInput({
      entries: body.entries ?? [],
      orders: body.orders ?? [],
      perpPositions: body.perpPositions,
      riskProfile: body.riskProfile ?? "balanced",
      analyze: body.analyze,
      governance: body.governance,
    });

    const budget = optimizeRiskBudget(budgetInput);

    let analyze = body.analyze ?? null;
    if (body.applyToAnalyze && analyze) {
      analyze = applyRiskBudgetToAnalyzeResponse(analyze, budget);
    }

    return NextResponse.json({
      ok: true,
      budget,
      analyze,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Optimize failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
