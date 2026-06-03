import { fetchLiveMarket } from "@/lib/bybit/market";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const market = await fetchLiveMarket();
    return NextResponse.json(market);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch market data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
