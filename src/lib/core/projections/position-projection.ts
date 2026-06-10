import type { JournalEvent } from "@/lib/journal/journal-types";
import { getLatestMonitoredSnapshots } from "@/lib/positions/position-monitor";
import { buildOpenTradesFromEvents } from "@/lib/trades/trade-store";

export interface PositionProjection {
  openTradeCount: number;
  snapshots: ReturnType<typeof getLatestMonitoredSnapshots> extends Map<string, infer V> ? V[] : never;
}

export function buildPositionProjection(events: JournalEvent[]): PositionProjection {
  const openTrades = buildOpenTradesFromEvents(events);
  const map = getLatestMonitoredSnapshots(events);
  return {
    openTradeCount: openTrades.length,
    snapshots: Array.from(map.values()),
  };
}

export function zeroPositionProjection(): PositionProjection {
  return { openTradeCount: 0, snapshots: [] };
}
