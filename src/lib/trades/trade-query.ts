import { getEvents } from "@/lib/journal/journal-query";
import { getLatestClosePreviewForTrade } from "@/lib/execution/close-preview-store";
import type { ClosePreview } from "@/lib/execution/close-preview-types";
import { getLatestMonitoredSnapshots } from "@/lib/positions/position-monitor";
import type { PositionSnapshot } from "@/lib/positions/position-types";
import { buildClosedTradesFromEvents, buildOpenTradesFromEvents } from "./trade-store";
import type { ClosedTrade, OpenTrade } from "./trade-types";

export interface OpenTradeWithPosition extends OpenTrade {
  position: PositionSnapshot | null;
  closePreview: ClosePreview | null;
}

export interface TradesSummary {
  open: OpenTradeWithPosition[];
  closed: ClosedTrade[];
  summary: {
    openCount: number;
    closedCount: number;
    realizedPnl: number;
    executionCount: number;
  };
}

export async function getTradesSummary(): Promise<TradesSummary> {
  const events = await getEvents();
  const openTrades = buildOpenTradesFromEvents(events);
  const snapshots = getLatestMonitoredSnapshots(events);
  const open: OpenTradeWithPosition[] = await Promise.all(
    openTrades.map(async (t) => ({
      ...t,
      position: snapshots.get(t.tradeId) ?? null,
      closePreview: await getLatestClosePreviewForTrade(t.tradeId),
    })),
  );
  const closed = buildClosedTradesFromEvents(events);  const realizedPnl = closed.reduce((sum, t) => sum + t.netPnl, 0);
  const executionCount = events.filter((e) => e.type === "ORDER_EXECUTED").length;

  return {
    open,
    closed,
    summary: {
      openCount: open.length,
      closedCount: closed.length,
      realizedPnl: Number(realizedPnl.toFixed(4)),
      executionCount,
    },
  };
}

export async function getLatestOpenTrade(): Promise<OpenTrade | null> {
  const { open } = await getTradesSummary();
  return open[0] ?? null;
}
