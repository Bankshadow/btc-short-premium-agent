import { applyAdaptationProposal } from "@/lib/strategy-adaptation/apply-proposal";
import type {
  AdaptationApplyInput,
  StrategyAdaptationProposal,
} from "@/lib/strategy-adaptation/types";
import type { StrategySkill } from "@/lib/strategy-registry/strategy-registry-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = AdaptationApplyInput;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    if (!body.proposal?.proposalId || !body.action) {
      return NextResponse.json(
        { ok: false, error: "proposal and action required." },
        { status: 400 },
      );
    }

    const result = applyAdaptationProposal({
      proposalId: body.proposalId,
      action: body.action,
      operatorNote: body.operatorNote,
      editedReason: body.editedReason,
      proposal: body.proposal as StrategyAdaptationProposal,
      registry: body.registry ?? { strategies: [] as StrategySkill[] },
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json({
      ...result,
      autoApply: false,
      clientMustPersist: true,
      safetyNotice:
        "Apply registry patch in browser via proposal-store — server does not auto-modify registry.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Adaptation apply failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
