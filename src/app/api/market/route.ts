import { fetchMarketSnapshot } from "@/lib/bybit/market";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const snapshot = await fetchMarketSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch market data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
