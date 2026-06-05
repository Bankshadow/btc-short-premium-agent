import { runDeskAutomation } from "@/lib/automation/run-desk-automation";
import type { DeskAutomationInput } from "@/lib/automation/automation-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = DeskAutomationInput & {
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
};

export async function POST(request: Request) {
  try {
    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      /* empty body — server-only modules */
    }

    const result = await runDeskAutomation({
      entries: body.entries,
      orders: body.orders,
      perpPositions: body.perpPositions,
      riskProfile: body.riskProfile,
      currentEquity: body.currentEquity,
      modules: body.modules,
      topic: body.topic,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Desk automation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    mvp: 34,
    description:
      "POST with entries/orders from client to run full desk automation cycle.",
    modules: [
      "analyze",
      "assets",
      "council",
      "mortem",
      "simulation",
      "war_room",
      "capital",
      "validation",
      "frequency",
      "exchange",
      "operator",
    ],
    clientHint:
      "Open /automation or enable auto-cycle on dashboard. Pass journal for best results.",
  });
}
