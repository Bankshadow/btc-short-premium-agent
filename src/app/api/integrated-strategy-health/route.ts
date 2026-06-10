import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";
import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import { loadRegistryHealthRecommendations } from "@/lib/integrated-strategy-health";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 74 — integrated strategy health after 12 testnet trades. */
export async function GET() {
  try {
    const liveBlock = blockBinanceProductionOrder();
    if (liveBlock) {
      return NextResponse.json(
        { ok: false, error: liveBlock, liveBlocked: true },
        { status: 422 },
      );
    }
    const [snapshot, registryRecommendations] = await Promise.all([
      buildTestnetMonitorSnapshot(),
      loadRegistryHealthRecommendations(),
    ]);
    return NextResponse.json({
      ok: true,
      integratedStrategyHealth: snapshot.integratedStrategyHealth,
      registryRecommendations,
      agentScoreboard: snapshot.agentScoreboardSegment,
      connected: snapshot.connected,
      lastUpdatedAt: snapshot.lastUpdatedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Integrated strategy health failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
