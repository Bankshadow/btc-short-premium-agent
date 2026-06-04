import { runScenarioDrill } from "@/lib/war-room/scenario-drill-engine";
import type { WarRoomScenarioId } from "@/lib/war-room/scenario-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Body = {
  scenarioId: WarRoomScenarioId;
  entries?: DecisionLogEntry[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.scenarioId) {
      return NextResponse.json({ error: "scenarioId required" }, { status: 400 });
    }

    const result = runScenarioDrill({
      scenarioId: body.scenarioId,
      entries: body.entries ?? [],
    });

    return NextResponse.json({
      drill: result,
      cannotPlaceOrders: true,
      analysisPaperOnly: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scenario drill failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
