import { runCouncilSession } from "@/lib/council/run-council-session";
import type { CouncilRunRequest } from "@/lib/council/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CouncilRunBody = CouncilRunRequest & {
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  riskProfile?: "balanced" | "aggressive";
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
      riskProfile: body.riskProfile ?? "balanced",
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Council session failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
