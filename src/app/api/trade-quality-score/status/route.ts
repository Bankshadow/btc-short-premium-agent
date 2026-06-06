import { NextResponse } from "next/server";
import { getTradeQualityStatus } from "@/lib/trade-quality-score/run-quality-update";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 84 — trade quality score status. */
export async function GET() {
  try {
    const status = await getTradeQualityStatus();
    return NextResponse.json({ ok: true, mvp: 84, status, executionBlocked: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
