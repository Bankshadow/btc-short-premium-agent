import type { JournalEvent } from "@/lib/journal/journal-types";
import { listValidRealizedPnlEvents } from "@/lib/pnl/pnl-store";

export interface PnlProjection {
  realizedCount: number;
  pendingCount: number;
  totalNetPnl: number;
}

export function buildPnlProjection(events: JournalEvent[]): PnlProjection {
  const realized = listValidRealizedPnlEvents(events);
  const closedTradeIds = new Set(
    events.filter((e) => e.type === "POSITION_CLOSED").map((e) => e.tradeId).filter(Boolean),
  );
  const validRealizedTradeIds = new Set(realized.map((e) => e.tradeId).filter(Boolean));
  const totalNetPnl = realized.reduce((sum, e) => {
    const pnl = (e.payload as { netPnl?: number }).netPnl ?? 0;
    return sum + pnl;
  }, 0);
  let pendingCount = 0;
  for (const tradeId of closedTradeIds) {
    if (!validRealizedTradeIds.has(tradeId)) pendingCount += 1;
  }
  return {
    realizedCount: realized.length,
    pendingCount,
    totalNetPnl: Number(totalNetPnl.toFixed(4)),
  };
}

export function zeroPnlProjection(): PnlProjection {
  return { realizedCount: 0, pendingCount: 0, totalNetPnl: 0 };
}
