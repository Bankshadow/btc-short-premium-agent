import { NextResponse } from "next/server";
import { getPnlRecordByTradeId } from "@/lib/pnl/pnl-store";

export async function GET(_req: Request, ctx: { params: Promise<{ tradeId: string }> }) {
  try {
    const { tradeId } = await ctx.params;
    const record = await getPnlRecordByTradeId(tradeId);
    if (!record) {
      return NextResponse.json({ record: null, message: "No PnL record for trade." }, { status: 404 });
    }
    return NextResponse.json({ record });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load PnL" },
      { status: 500 },
    );
  }
}
