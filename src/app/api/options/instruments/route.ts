import { fetchOptionCandidates } from "@/lib/bybit/market";
import { parseOptionSymbol } from "@/lib/bybit/option-chain";
import { getOptionsExecutionStatus } from "@/lib/options-execution/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const candidates = await fetchOptionCandidates();
    const status = getOptionsExecutionStatus();

    const instruments = candidates.map((c) => {
      const parsed = parseOptionSymbol(c.symbol);
      return {
        symbol: c.symbol,
        strike: c.strike,
        expiry: c.expiry,
        optionType: c.optionType,
        markPrice: c.markPrice,
        bid: c.bid,
        ask: c.ask,
        delta: c.delta,
        iv: c.impliedVolatility,
        expiryTimeMs: parsed?.expiryTime ?? null,
        spreadPct:
          c.markPrice > 0
            ? Number((((c.ask - c.bid) / c.markPrice) * 100).toFixed(2))
            : null,
      };
    });

    return NextResponse.json({
      ok: true,
      count: instruments.length,
      instruments,
      executionStatus: status,
      previewOnly: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Instruments fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
