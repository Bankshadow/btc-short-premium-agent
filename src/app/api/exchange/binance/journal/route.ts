import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const journal = await loadServerBinanceTestnetJournal();
    return NextResponse.json({ ok: true, journal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Journal fetch failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
