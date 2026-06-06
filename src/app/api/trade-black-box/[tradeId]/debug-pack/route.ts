import { NextResponse } from "next/server";
import { buildDebugPack, debugPackFilename } from "@/lib/trade-black-box/export-debug-pack";
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

    const pack = buildDebugPack(record);
    const body = JSON.stringify(pack, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${debugPackFilename(tradeId)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Debug pack export failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
