import { NextResponse } from "next/server";
import { getDailySelfReviewStatus } from "@/lib/daily-self-review/run-daily-self-review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 82 — latest daily AI self-review for Reports UI. */
export async function GET() {
  try {
    const status = await getDailySelfReviewStatus();
    return NextResponse.json({
      ok: true,
      mvp: 82,
      status,
      executionBlocked: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
