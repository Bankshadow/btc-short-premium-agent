import { NextResponse } from "next/server";
import { runTradeQualityUpdate } from "@/lib/trade-quality-score/run-quality-update";
import { TRADE_QUALITY_SAFETY_NOTICE } from "@/lib/trade-quality-score/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 84 — recompute trade quality scores for resolved trades. */
export async function POST() {
  try {
    const result = await runTradeQualityUpdate();
    return NextResponse.json({
      ...result,
      mvp: 84,
      safetyNotice: TRADE_QUALITY_SAFETY_NOTICE,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recompute failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
