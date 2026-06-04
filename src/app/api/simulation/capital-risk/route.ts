import { runCapitalRiskSimulator } from "@/lib/simulation/capital-risk-simulator";
import { runDrawdownSimulator } from "@/lib/simulation/drawdown-simulator";
import {
  defaultCapitalRiskInput,
  runMilestoneProjection,
} from "@/lib/simulation/milestone-projection";
import { deriveTradingStatsFromLog, deriveEquityFromLog } from "@/lib/simulation/derive-stats";
import type { CapitalRiskSimulatorInput } from "@/lib/simulation/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Body = Partial<CapitalRiskSimulatorInput> & {
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
};

export async function POST(request: Request) {
  try {
    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      /* empty */
    }

    const stats = deriveTradingStatsFromLog(body.entries ?? []);
    const currentEquity =
      body.currentEquity ??
      deriveEquityFromLog(body.entries ?? [], body.orders ?? []);

    const input = defaultCapitalRiskInput({
      ...body,
      currentEquity,
      winRate: body.winRate ?? stats.winRate,
      averageWinR: body.averageWinR ?? stats.averageWinR,
      averageLossR: body.averageLossR ?? stats.averageLossR,
    });

    const capitalRisk = runCapitalRiskSimulator(input);
    const milestone = runMilestoneProjection({
      currentEquity: input.currentEquity,
      winRate: input.winRate,
      averageWinR: input.averageWinR,
      averageLossR: input.averageLossR,
      riskPerTradePct: input.riskPerTradePct,
      probabilityReachTarget: capitalRisk.probabilityReachTarget,
    });
    const drawdown = runDrawdownSimulator({
      currentEquity: input.currentEquity,
      riskPerTradePct: input.riskPerTradePct,
      averageLossR: input.averageLossR,
      maxDrawdownPct: input.maxDrawdownPct,
    });

    const aggressiveBlocked =
      capitalRisk.probabilityRuin > 20 ||
      capitalRisk.expectedMaxDrawdown > input.maxDrawdownPct ||
      stats.avgR <= 0;

    return NextResponse.json({
      capitalRisk,
      milestone,
      drawdown,
      derivedStats: stats,
      aggressiveModeSafe: !aggressiveBlocked,
      advisoryOnly: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
