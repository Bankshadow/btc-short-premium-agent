import { executeExperimentRun } from "@/lib/strategy-experiments/run-experiment";
import { EXPERIMENT_SAFETY_NOTICE } from "@/lib/strategy-experiments/types";
import type { StrategyExperiment } from "@/lib/strategy-experiments/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      experiment: StrategyExperiment;
      entries?: DecisionLogEntry[];
      orders?: PaperOrder[];
    };

    if (!body.experiment) {
      return NextResponse.json(
        { ok: false, error: "experiment required" },
        { status: 400 },
      );
    }

    const updated = executeExperimentRun(body.experiment, {
      experimentId: body.experiment.experimentId,
      entries: body.entries ?? [],
      orders: body.orders,
    });

    return NextResponse.json({
      ok: true,
      experiment: updated,
      clientMustPersist: true,
      cannotPlaceLiveTrades: true,
      safetyNotice: EXPERIMENT_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Experiment run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
