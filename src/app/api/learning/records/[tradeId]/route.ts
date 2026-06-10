import { NextResponse } from "next/server";
import { getLearningByTradeId } from "@/lib/learning/learning-store";

export async function GET(_req: Request, ctx: { params: Promise<{ tradeId: string }> }) {
  try {
    const { tradeId } = await ctx.params;
    const record = await getLearningByTradeId(tradeId);
    if (!record) {
      return NextResponse.json({ record: null, message: "No learning record." }, { status: 404 });
    }
    return NextResponse.json({ record });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load learning record" },
      { status: 500 },
    );
  }
}
