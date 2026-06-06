import { NextResponse } from "next/server";
import { runTradeBlackBoxCapture } from "@/lib/trade-black-box/run-capture";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await runTradeBlackBoxCapture();
    return NextResponse.json({
      ...result,
      ok: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Black box capture failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
