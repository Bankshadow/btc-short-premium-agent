import { buildDashboardData, readPolymarketStore } from "@/lib/polymarket/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const store = readPolymarketStore();
    const dashboard = buildDashboardData(store);
    return NextResponse.json({
      ok: true,
      sprint: "mvp-21.1-sweeper",
      paperOnly: true,
      orderBooks: dashboard.orderBooks,
      opportunities: dashboard.sweeperOpportunities,
      blocked: dashboard.blockedSweeperOpportunities,
      paperTrades: dashboard.sweeperPaperTrades,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load sweeper data" },
      { status: 500 },
    );
  }
}
