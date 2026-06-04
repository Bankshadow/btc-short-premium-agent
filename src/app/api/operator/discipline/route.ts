import { buildOperatorBehaviorAnalytics } from "@/lib/operator/operator-behavior-analytics";
import { buildOperatorDisciplineReport } from "@/lib/operator/operator-discipline-score";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { OperatorOverrideLogEntry } from "@/lib/governance/governance-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    message:
      "POST with entries and overrideLog for discipline report. Advisory only — no auto risk changes.",
    operatorDisciplineScore: 0,
    advisoryOnly: true,
  });
}

export async function POST(request: Request) {
  try {
    let body: {
      entries?: DecisionLogEntry[];
      overrideLog?: OperatorOverrideLogEntry[];
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      /* empty */
    }

    const analytics = buildOperatorBehaviorAnalytics({
      entries: body.entries ?? [],
      overrideLog: body.overrideLog ?? [],
    });
    const report = buildOperatorDisciplineReport(analytics);

    return NextResponse.json({
      ...report,
      advisoryOnly: true,
      cannotAutoChangeRiskProfile: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Discipline report failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
