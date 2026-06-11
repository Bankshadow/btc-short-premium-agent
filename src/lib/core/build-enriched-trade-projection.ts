import { getLatestClosePreviewForTrade } from "@/lib/execution/close-preview-store";
import type { JournalEvent } from "@/lib/journal/journal-types";
import { getLatestMonitoredSnapshots } from "@/lib/positions/position-snapshots-from-events";
import type { OpenTradeWithPosition } from "@/lib/trades/trade-query";
import { buildPnlProjection } from "./projections/pnl-projection";
import { buildTradeProjection } from "./projections/trade-projection";
import { applyTradeReconciliation } from "./trade-reconciliation";

export interface EnrichedTradeProjection {
  open: OpenTradeWithPosition[];
  closed: ReturnType<typeof buildTradeProjection>["closed"];
  staleOpenWarnings: ReturnType<typeof applyTradeReconciliation>["staleOpenWarnings"];
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
  const reconciled = applyTradeReconciliation(events);
  const snapshots = getLatestMonitoredSnapshots(events);
  const enrichedOpen: OpenTradeWithPosition[] = await Promise.all(
    reconciled.open.map(async (t) => ({
      ...t,
      position: snapshots.get(t.tradeId) ?? null,
      closePreview: await getLatestClosePreviewForTrade(t.tradeId),
    })),
  );
  const pnl = buildPnlProjection(events);
  const executionCount = events.filter((e) => e.type === "ORDER_EXECUTED").length;

  return {
    open: enrichedOpen,
    closed: reconciled.closed,
    staleOpenWarnings: reconciled.staleOpenWarnings,
    summary: {
      openCount: reconciled.effectiveOpenCount,
      closedCount: reconciled.closed.length,
      realizedPnl: pnl.totalNetPnl,
      executionCount,
    },
  };
}
