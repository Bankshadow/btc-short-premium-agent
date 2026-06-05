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
import {
  applyRealTimeRiskToBudget,
  enrichRealTimeRiskInput,
  evaluateRealTimeRisk,
} from "@/lib/real-time-risk";
import type { RealTimeRiskInput } from "@/lib/real-time-risk";
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
      realTimeRiskInput?: Partial<RealTimeRiskInput>;
    };

    const budgetInput = buildRiskBudgetInput({
      entries: body.entries ?? [],
      orders: body.orders ?? [],
      perpPositions: body.perpPositions,
      riskProfile: body.riskProfile ?? "balanced",
      analyze: body.analyze,
      governance: body.governance,
    });

    let budget = optimizeRiskBudget(budgetInput);

    let realTimeRisk = null;
    if (body.realTimeRiskInput) {
      const riskInput = await enrichRealTimeRiskInput({
        entries: body.entries ?? [],
        orders: body.orders ?? [],
        perpPositions: body.perpPositions,
        ...body.realTimeRiskInput,
      });
      realTimeRisk = evaluateRealTimeRisk(riskInput);
      budget = applyRealTimeRiskToBudget(budget, realTimeRisk);
    }

    let analyze = body.analyze ?? null;
    if (body.applyToAnalyze && analyze) {
      analyze = applyRiskBudgetToAnalyzeResponse(analyze, budget);
    }

    return NextResponse.json({
      ok: true,
      budget,
      realTimeRisk,
      analyze,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Optimize failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
