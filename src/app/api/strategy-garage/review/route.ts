import { NextResponse } from "next/server";
import { runGarageAiReview } from "@/lib/strategy-garage/run-ai-review";
import { STRATEGY_GARAGE_SAFETY_NOTICE } from "@/lib/strategy-garage/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 81 — run AI advisory review on a garage strategy. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sourceId?: string };
    if (!body.sourceId?.trim()) {
      return NextResponse.json({ ok: false, error: "sourceId required" }, { status: 400 });
    }
    const result = await runGarageAiReview(body.sourceId);
    return NextResponse.json({
      ...result,
      mvp: 81,
      safetyNotice: STRATEGY_GARAGE_SAFETY_NOTICE,
      executionBlocked: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
