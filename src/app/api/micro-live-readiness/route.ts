import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";
import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import { loadReadinessAuditLog } from "@/lib/micro-live-readiness";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 75 — micro-live readiness assessment (live stays locked). */
export async function GET() {
  try {
    const liveBlock = blockBinanceProductionOrder();
    if (liveBlock) {
      return NextResponse.json(
        { ok: false, error: liveBlock, liveBlocked: true },
        { status: 422 },
      );
    }
    const [snapshot, auditLog] = await Promise.all([
      buildTestnetMonitorSnapshot(),
      loadReadinessAuditLog(),
    ]);
    return NextResponse.json({
      ok: true,
      microLiveReadiness: snapshot.microLiveReadiness,
      auditLog: auditLog.slice(0, 20),
      connected: snapshot.connected,
      lastUpdatedAt: snapshot.lastUpdatedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Micro-live readiness failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
