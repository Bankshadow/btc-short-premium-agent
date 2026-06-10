import type { JournalEvent } from "@/lib/journal/journal-types";
import { buildClosedTradesFromEvents, buildOpenTradesFromEvents } from "@/lib/trades/trade-store";

export interface TradeProjection {
  open: ReturnType<typeof buildOpenTradesFromEvents>;
  closed: ReturnType<typeof buildClosedTradesFromEvents>;
}

export function buildTradeProjection(events: JournalEvent[]): TradeProjection {
  return {
    open: buildOpenTradesFromEvents(events),
    closed: buildClosedTradesFromEvents(events),
  };
}

export function zeroTradeProjection(): TradeProjection {
  return { open: [], closed: [] };
}
