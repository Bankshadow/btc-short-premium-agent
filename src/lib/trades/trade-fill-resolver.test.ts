import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPnlProjection } from "@/lib/core/projections/pnl-projection";
import { listPendingPnlTrades } from "@/lib/pnl/pnl-pending";
import { isValidRealizedPnlEvent } from "@/lib/pnl/pnl-store";
import { buildOpenTradesFromEvents } from "@/lib/trades/trade-store";
import type { JournalEvent } from "@/lib/journal/journal-types";

function evt(partial: Partial<JournalEvent> & Pick<JournalEvent, "type">): JournalEvent {
  return {
    eventId: `evt-${partial.type}`,
    timestamp: partial.timestamp ?? "2026-06-12T00:00:00.000Z",
    environment: "testnet",
    ...partial,
    payload: partial.payload ?? {},
  } as JournalEvent;
}

describe("trade fill resolver + pnl pending alignment", () => {
  it("enriches open trade qty from POSITION_MONITORED when order qty is zero", () => {
    const tradeId = "trade-open";
    const events: JournalEvent[] = [
      evt({
        type: "ORDER_EXECUTED",
        tradeId,
        payload: { symbol: "BTCUSDT", side: "SELL", qty: "0", orderId: "1" },
      }),
      evt({
        type: "POSITION_OPENED",
        tradeId,
        payload: { qty: "0", entryPrice: null },
      }),
      evt({
        type: "POSITION_MONITORED",
        tradeId,
        timestamp: "2026-06-12T00:00:01.000Z",
        payload: {
          symbol: "BTCUSDT",
          side: "SHORT",
          qty: "0.011",
          entryPrice: 62906.17,
          status: "OPEN",
        },
      }),
    ];

    const open = buildOpenTradesFromEvents(events);
    assert.equal(open.length, 1);
    assert.equal(open[0].qty, "0.011");
    assert.equal(open[0].entryPrice, 62906.17);
  });

  it("treats invalid PNL_REALIZED as pending in projection and pending list", () => {
    const tradeId = "trade-closed";
    const events: JournalEvent[] = [
      evt({
        type: "ORDER_EXECUTED",
        tradeId,
        payload: { symbol: "BTCUSDT", side: "SELL", qty: "0", orderId: "1" },
      }),
      evt({
        type: "POSITION_OPENED",
        tradeId,
        payload: { qty: "0", entryPrice: null },
      }),
      evt({
        type: "POSITION_CLOSED",
        tradeId,
        timestamp: "2026-06-12T00:00:02.000Z",
        payload: { closeOrderId: "close-1" },
      }),
      evt({
        type: "PNL_REALIZED",
        tradeId,
        payload: { netPnl: 0, entryPrice: 0, exitPrice: 0, qty: "0", result: "BREAKEVEN" },
      }),
    ];

    const invalid = events.find((e) => e.type === "PNL_REALIZED");
    assert.ok(invalid);
    assert.equal(isValidRealizedPnlEvent(invalid!), false);

    const projection = buildPnlProjection(events);
    assert.equal(projection.realizedCount, 0);
    assert.equal(projection.pendingCount, 1);

    const pending = listPendingPnlTrades(events);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].tradeId, tradeId);
  });
});
