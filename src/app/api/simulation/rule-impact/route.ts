import { simulateRuleImpact } from "@/lib/rules/rule-impact-simulator";
import type { DraftRule } from "@/lib/journal/draft-rules";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Body = {
  rule?: DraftRule | { id: string; description: string; title?: string };
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.rule?.id || !body.rule?.description) {
      return NextResponse.json(
        { error: "rule id and description required" },
        { status: 400 },
      );
    }

    const result = simulateRuleImpact({
      rule: body.rule,
      entries: body.entries ?? [],
      orders: body.orders,
    });

    return NextResponse.json({
      ...result,
      advisoryOnly: true,
      cannotAutoPromote: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rule impact failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
