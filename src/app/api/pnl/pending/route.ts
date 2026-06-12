import { NextResponse } from "next/server";
import { getEvents } from "@/lib/journal/journal-query";
import { listPendingPnlTrades } from "@/lib/pnl/pnl-pending";
import { buildPnlProjection } from "@/lib/core/projections/pnl-projection";

export async function GET() {
  try {
    const events = await getEvents();
    const pending = listPendingPnlTrades(events);
    const summary = buildPnlProjection(events);

    return NextResponse.json({
      ok: true,
      count: pending.length,
      realizedCount: summary.realizedCount,
      pendingCount: summary.pendingCount,
      totalNetPnl: summary.totalNetPnl,
      trades: pending.map((t) => ({
        tradeId: t.tradeId,
        positionId: t.positionId,
        symbol: t.symbol,
        side: t.side,
        qty: t.qty,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        closedAt: t.closedAt,
        reasons: t.reasons,
        message: t.message,
        lastPendingAt: t.lastPendingAt,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to list pending PnL trades" },
      { status: 500 },
    );
  }
}
