import { NextResponse } from "next/server";
import { getLatestRuleEvaluation } from "@/lib/rules/rule-evaluator";

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
