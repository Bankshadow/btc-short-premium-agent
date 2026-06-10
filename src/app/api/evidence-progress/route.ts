import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";
import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 73A — 12-trade testnet evidence progress for AI evaluation. */
export async function GET() {
  try {
    const liveBlock = blockBinanceProductionOrder();
    if (liveBlock) {
      return NextResponse.json(
        { ok: false, error: liveBlock, liveBlocked: true },
        { status: 422 },
      );
    }
    const snapshot = await buildTestnetMonitorSnapshot();
    return NextResponse.json({
      ok: true,
      evidence: snapshot.evidenceProgress,
      connected: snapshot.connected,
      lastUpdatedAt: snapshot.lastUpdatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evidence progress failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
