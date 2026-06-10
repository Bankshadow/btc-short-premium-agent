import { NextResponse } from "next/server";
import { calculatePnlForTrade } from "@/lib/pnl/calculate-pnl";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tradeId?: string };
    if (!body.tradeId) {
      return NextResponse.json({ error: "tradeId is required" }, { status: 400 });
    }
    const result = await calculatePnlForTrade(body.tradeId);
    return NextResponse.json(result, { status: result.ok ? 200 : 403 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PnL calculation failed" },
      { status: 500 },
    );
  }
}
