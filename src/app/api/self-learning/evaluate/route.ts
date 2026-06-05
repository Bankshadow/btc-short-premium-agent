import { runBatchEvaluation, runPostTradeEvaluation } from "@/lib/self-learning/run-evaluation";
import { buildLearningEvaluationReport } from "@/lib/self-learning/build-learning-report";
import { SELF_LEARNING_SAFETY_NOTICE } from "@/lib/self-learning/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PostTradeEvaluationSource } from "@/lib/self-learning/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EvaluateBody = {
  entries?: DecisionLogEntry[];
  entryId?: string;
  source?: PostTradeEvaluationSource;
  pnlOverride?: number;
  batch?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EvaluateBody;
    const entries = body.entries ?? [];

    if (body.batch) {
      const results = runBatchEvaluation(entries, false);
      const report = buildLearningEvaluationReport({ entries, storedResults: results });
      return NextResponse.json({
        ok: true,
        results,
        report,
        clientMustPersist: true,
        cannotAutoChangeLive: true,
        proposalsOnly: true,
        safetyNotice: SELF_LEARNING_SAFETY_NOTICE,
      });
    }

    const entry =
      body.entryId != null
        ? entries.find((e) => e.id === body.entryId)
        : entries.find((e) => e.outcomeStatus === "RESOLVED");

    if (!entry) {
      return NextResponse.json(
        { ok: false, error: "No resolved entry found for evaluation." },
        { status: 400 },
      );
    }

    const result = runPostTradeEvaluation({
      entry,
      source: body.source ?? "manual_resolve",
      pnlOverride: body.pnlOverride,
      persist: false,
    });

    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Entry is not resolved — cannot evaluate." },
        { status: 400 },
      );
    }

    const report = buildLearningEvaluationReport({
      entries,
      storedResults: [result],
    });

    return NextResponse.json({
      ok: true,
      result,
      report,
      clientMustPersist: true,
      cannotAutoChangeLive: true,
      proposalsOnly: true,
      safetyNotice: SELF_LEARNING_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Self-learning evaluation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
