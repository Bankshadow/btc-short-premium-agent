import { getPolymarketDashboard } from "@/lib/polymarket/run-cycle";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = getPolymarketDashboard();
    return NextResponse.json({
      ok: true,
      sprint: "mvp-21-polymarket",
      liveLocked: true,
      realTradingEnabled: false,
      ...data,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Status failed" },
      { status: 500 },
    );
  }
}
