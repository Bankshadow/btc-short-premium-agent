import { checkTradeFrequency } from "@/lib/frequency/trade-frequency-governor";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { StrategyConflictAnalysis } from "@/lib/data-trust/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Body = {
  entries?: DecisionLogEntry[];
  conflict?: StrategyConflictAnalysis | null;
};

export async function POST(request: Request) {
  try {
    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      /* empty */
    }

    const result = checkTradeFrequency({
      entries: body.entries ?? [],
      conflict: body.conflict ?? null,
    });

    return NextResponse.json({
      ...result,
      advisoryOnly: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Frequency check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
