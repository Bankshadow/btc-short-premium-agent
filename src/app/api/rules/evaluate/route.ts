import { NextResponse } from "next/server";
import { getLatestRuleEvaluation, runRuleEvaluation } from "@/lib/rules/rule-evaluator";

export async function GET() {
  try {
    const evaluation = await getLatestRuleEvaluation();
    return NextResponse.json({ evaluation, sprint: "mvp-15" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load rules" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      runId?: string;
      decisionLogId?: string;
      proposedVerdict?: "TRADE" | "WAIT" | "BLOCKED";
      swarmAgreement?: "AGREE" | "DISAGREE" | "NEUTRAL" | "NO_SCENARIO";
      regime?: string;
    };
    const evaluation = await runRuleEvaluation({
      runId: body.runId ?? "run-manual",
      decisionLogId: body.decisionLogId ?? "dl-manual",
      proposedVerdict: body.proposedVerdict ?? "TRADE",
      swarmAgreement: body.swarmAgreement ?? "NO_SCENARIO",
      regime: (body.regime as never) ?? "UNKNOWN",
    });
    return NextResponse.json({ ok: true, evaluation, sprint: "mvp-15" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Evaluate failed" },
      { status: 500 },
    );
  }
}
