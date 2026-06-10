import type { JournalEvent } from "@/lib/journal/journal-types";

export interface PnlProjection {
  realizedCount: number;
  totalNetPnl: number;
}

export function buildPnlProjection(events: JournalEvent[]): PnlProjection {
  const realized = events.filter((e) => e.type === "PNL_REALIZED");
  const totalNetPnl = realized.reduce((sum, e) => {
    const pnl = (e.payload as { netPnl?: number }).netPnl ?? 0;
    return sum + pnl;
  }, 0);
  return { realizedCount: realized.length, totalNetPnl: Number(totalNetPnl.toFixed(4)) };
}

export function zeroPnlProjection(): PnlProjection {
  return { realizedCount: 0, totalNetPnl: 0 };
}
