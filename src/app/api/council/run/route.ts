import { runCouncilSession } from "@/lib/council/run-council-session";
import type { CouncilRunRequest } from "@/lib/council/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { StrategyAdaptationProposal } from "@/lib/strategy-adaptation/types";
import type { DeskIncident } from "@/lib/governance/governance-types";
import type { StrategySkill } from "@/lib/strategy-registry/strategy-registry-types";
import type { CouncilSessionResult } from "@/lib/council/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CouncilRunBody = CouncilRunRequest & {
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile?: "balanced" | "aggressive";
  adaptationProposals?: StrategyAdaptationProposal[];
  incidents?: DeskIncident[];
  councilSessions?: CouncilSessionResult[];
  registryStrategies?: StrategySkill[];
};

export async function POST(request: Request) {
  try {
    let body: CouncilRunBody = {};
    try {
      body = (await request.json()) as CouncilRunBody;
    } catch {
      // empty body ok — server runs with empty journal
    }

    const result = runCouncilSession({
      request: {
        topic: body.topic,
        currentEquity: body.currentEquity,
        startingCapital: body.startingCapital,
        goalCapital: body.goalCapital,
      },
      entries: body.entries ?? [],
      orders: body.orders ?? [],
      perpPositions: body.perpPositions ?? [],
      riskProfile: body.riskProfile ?? "balanced",
      adaptationProposals: body.adaptationProposals ?? [],
      incidents: body.incidents ?? [],
      councilSessions: body.councilSessions ?? [],
      registryStrategies: body.registryStrategies ?? [],
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Council session failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
