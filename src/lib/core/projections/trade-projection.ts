import type { JournalEvent } from "@/lib/journal/journal-types";
import { buildClosedTradesFromEvents, buildOpenTradesFromEvents } from "@/lib/trades/trade-store";
import type { ClosedTrade, OpenTrade } from "@/lib/trades/trade-types";
import {
  applyTradeReconciliation,
  type StaleOpenTradeWarning,
} from "../trade-reconciliation";

export interface TradeProjection {
  open: OpenTrade[];
  closed: ClosedTrade[];
  staleOpenWarnings?: StaleOpenTradeWarning[];
  effectiveOpenCount?: number;
}

export function buildTradeProjection(events: JournalEvent[]): TradeProjection {
  const reconciled = applyTradeReconciliation(events);
  return {
    open: reconciled.open,
    closed: reconciled.closed,
    staleOpenWarnings: reconciled.staleOpenWarnings,
    effectiveOpenCount: reconciled.effectiveOpenCount,
  };
}

export function zeroTradeProjection(): TradeProjection {
  return { open: [], closed: [], staleOpenWarnings: [], effectiveOpenCount: 0 };
}
