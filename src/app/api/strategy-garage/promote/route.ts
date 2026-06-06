import { NextResponse } from "next/server";
import { promoteGarageStrategy, STRATEGY_GARAGE_SAFETY_NOTICE } from "@/lib/strategy-garage";
import type { PromoteGarageInput } from "@/lib/strategy-garage/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 81 — promote or reject garage strategy stage (human approval required). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PromoteGarageInput;
    if (!body.sourceId?.trim() || !body.targetStage) {
      return NextResponse.json(
        { ok: false, error: "sourceId and targetStage required" },
        { status: 400 },
      );
    }
    const result = await promoteGarageStrategy(body);
    return NextResponse.json({
      mvp: 81,
      safetyNotice: STRATEGY_GARAGE_SAFETY_NOTICE,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Promote failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
