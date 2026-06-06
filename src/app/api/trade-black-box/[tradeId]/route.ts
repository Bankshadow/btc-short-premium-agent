import { NextResponse } from "next/server";
import { captureTradeBlackBox } from "@/lib/trade-black-box/run-capture";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tradeId: string }> },
) {
  try {
    const { tradeId } = await context.params;
    if (!tradeId) {
      return NextResponse.json(
        { ok: false, error: "tradeId required" },
        { status: 400 },
      );
    }

    const record = await captureTradeBlackBox(tradeId);
    if (!record) {
      return NextResponse.json(
        { ok: false, error: "Trade black box not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      record,
      safetyNotice: record.safetyNotice,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Black box fetch failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
