import { applyPromotionPure } from "@/lib/strategy-experiments/apply-promotion";
import { EXPERIMENT_SAFETY_NOTICE } from "@/lib/strategy-experiments/types";
import type { PromoteExperimentInput, StrategyExperiment } from "@/lib/strategy-experiments/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PromoteExperimentInput & {
      experiment: StrategyExperiment;
    };

    if (!body.experiment?.promotionProposal) {
      return NextResponse.json(
        { ok: false, error: "No promotion proposal on experiment" },
        { status: 400 },
      );
    }

    const result = applyPromotionPure({
      experiment: body.experiment,
      proposal: body.experiment.promotionProposal,
      action: body.action,
      reviewerNote: body.reviewerNote,
    });

    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Promotion action failed" },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      experiment: result.experiment,
      proposal: result.proposal,
      auditEntry: result.auditEntry,
      registryPatch: result.registryPatch,
      clientMustPersist: true,
      cannotChangeActiveWithoutApproval: true,
      safetyNotice: EXPERIMENT_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Promotion failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
