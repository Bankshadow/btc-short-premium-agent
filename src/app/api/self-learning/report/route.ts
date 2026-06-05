import { buildLearningEvaluationReport } from "@/lib/self-learning/build-learning-report";
import { SELF_LEARNING_SAFETY_NOTICE } from "@/lib/self-learning/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TradeEvaluationResult } from "@/lib/self-learning/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    cannotAutoChangeLive: true,
    proposalsOnly: true,
    safetyNotice: SELF_LEARNING_SAFETY_NOTICE,
    hint: "POST entries and storedResults to /api/self-learning/evaluate?batch=true or send entries via POST body on this route.",
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      entries?: DecisionLogEntry[];
      storedResults?: TradeEvaluationResult[];
    };

    const report = buildLearningEvaluationReport({
      entries: body.entries ?? [],
      storedResults: body.storedResults,
    });

    return NextResponse.json({
      ok: true,
      report,
      cannotAutoChangeLive: true,
      proposalsOnly: true,
      safetyNotice: SELF_LEARNING_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Learning report build failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
