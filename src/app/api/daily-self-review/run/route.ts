import { NextResponse } from "next/server";
import { runDailySelfReview } from "@/lib/daily-self-review/run-daily-self-review";
import { DAILY_SELF_REVIEW_SAFETY_NOTICE } from "@/lib/daily-self-review/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 82 — run daily AI self-review (manual trigger). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { force?: boolean };
    const result = await runDailySelfReview({
      trigger: "manual",
      force: body.force === true,
    });
    return NextResponse.json({
      ...result,
      mvp: 82,
      safetyNotice: DAILY_SELF_REVIEW_SAFETY_NOTICE,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
