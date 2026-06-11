import { getLatestClosePreviewForTrade } from "@/lib/execution/close-preview-store";
import type { JournalEvent } from "@/lib/journal/journal-types";
import { getLatestMonitoredSnapshots } from "@/lib/positions/position-monitor";
import type { OpenTradeWithPosition } from "@/lib/trades/trade-query";
import { buildPnlProjection } from "./projections/pnl-projection";
import { buildTradeProjection } from "./projections/trade-projection";

export interface EnrichedTradeProjection {
  open: OpenTradeWithPosition[];
  closed: ReturnType<typeof buildTradeProjection>["closed"];
  summary: {
    openCount: number;
    closedCount: number;
    realizedPnl: number;
    executionCount: number;
  };
}

export async function buildEnrichedTradeProjection(
  events: JournalEvent[],
): Promise<EnrichedTradeProjection> {
  const { open, closed } = buildTradeProjection(events);
  const snapshots = getLatestMonitoredSnapshots(events);
  const enrichedOpen: OpenTradeWithPosition[] = await Promise.all(
    open.map(async (t) => ({
      ...t,
      position: snapshots.get(t.tradeId) ?? null,
      closePreview: await getLatestClosePreviewForTrade(t.tradeId),
    })),
  );
  const pnl = buildPnlProjection(events);
  const executionCount = events.filter((e) => e.type === "ORDER_EXECUTED").length;

  return {
    open: enrichedOpen,
    closed,
    summary: {
      openCount: enrichedOpen.length,
      closedCount: closed.length,
      realizedPnl: pnl.totalNetPnl,
      executionCount,
    },
  };
}
