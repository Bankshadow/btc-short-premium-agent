import {
  buildPnlReport,
  buildTestnetMonitorSnapshot,
} from "@/lib/testnet-monitor";
import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const liveBlock = blockBinanceProductionOrder();
    if (liveBlock) {
      return NextResponse.json({ ok: false, error: liveBlock }, { status: 422 });
    }
    const snapshot = await buildTestnetMonitorSnapshot();
    return NextResponse.json({ ok: true, ...buildPnlReport(snapshot) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PnL failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
