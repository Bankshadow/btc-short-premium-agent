import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";
import { recordMonitorEvent } from "@/lib/testnet-monitor/monitor-journal-server";
import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const liveBlock = blockBinanceProductionOrder();
    if (liveBlock) {
      return NextResponse.json({ ok: false, error: liveBlock }, { status: 422 });
    }
    const snapshot = await buildTestnetMonitorSnapshot();
    await recordMonitorEvent({
      exchange: "BINANCE",
      environment: "TESTNET",
      eventType: "POSITION_OPENED",
      symbol: null,
      payload: {
        refreshed: true,
        openPositions: snapshot.openPositions.length,
        closedTrades: snapshot.closedTrades.length,
      },
      decisionLogId: null,
      orderId: null,
      positionId: null,
    });
    return NextResponse.json({ ok: true, ...snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
