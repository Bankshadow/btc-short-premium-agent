import { NextResponse } from "next/server";
import { promoteFromShadow } from "@/lib/strategy-shadow/promote-shadow";
import { SHADOW_PROMOTION_RULES, STRATEGY_SHADOW_SAFETY_NOTICE } from "@/lib/strategy-shadow/types";
import type { PromoteShadowInput } from "@/lib/strategy-shadow/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 70 — promote import after shadow evidence + human approval. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<PromoteShadowInput>;
    if (!body.sourceId) {
      return NextResponse.json(
        { ok: false, error: "sourceId required" },
        { status: 400 },
      );
    }

    const result = await promoteFromShadow({
      sourceId: body.sourceId,
      humanApproval: body.humanApproval === true,
      operatorNote: body.operatorNote,
      targetStatus: body.targetStatus,
    });

    return NextResponse.json({
      ...result,
      mvp: 70,
      cannotCountAsLiveProof: true,
      promotionRules: SHADOW_PROMOTION_RULES,
      safetyNotice: STRATEGY_SHADOW_SAFETY_NOTICE,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Shadow promotion failed";
    return NextResponse.json(
      { ok: false, error: message, safetyNotice: STRATEGY_SHADOW_SAFETY_NOTICE },
      { status: 500 },
    );
  }
}
