import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JournalEvent } from "@/lib/journal/journal-types";
import {
  findCanonicalPositionClosed,
  listDuplicatePositionClosedTradeIds,
  pickCanonicalPositionClosed,
} from "@/lib/journal/journal-close-events";
import { listDuplicateTradeIds } from "@/lib/evidence/evidence-validator";
import { buildClosedTradesFromEvents } from "@/lib/trades/trade-store";

function evt(partial: Partial<JournalEvent> & Pick<JournalEvent, "type">): JournalEvent {
  return {
    eventId: partial.eventId ?? `evt-${partial.type}-${Math.random()}`,
    timestamp: partial.timestamp ?? "2026-06-12T00:00:00.000Z",
    environment: "testnet",
    tradeId: partial.tradeId ?? "trade-1",
    ...partial,
    payload: partial.payload ?? {},
  } as JournalEvent;
}

describe("journal close event dedupe", () => {
  it("prefers BINANCE_TESTNET close over reconciliation backfill", () => {
    const events = [
      evt({
        eventId: "backfill",
        type: "POSITION_CLOSED",
        tradeId: "trade-1",
        timestamp: "2026-06-12T00:00:01.000Z",
        payload: { source: "RECONCILIATION_BACKFILL", closeOrderId: "reconcile-trade-1" },
      }),
      evt({
        eventId: "real",
        type: "POSITION_CLOSED",
        tradeId: "trade-1",
        timestamp: "2026-06-12T00:00:02.000Z",
        payload: { source: "BINANCE_TESTNET", closeOrderId: "14990191892" },
      }),
    ];

    const canonical = findCanonicalPositionClosed("trade-1", events);
    assert.equal(canonical?.eventId, "real");
    assert.deepEqual(listDuplicatePositionClosedTradeIds(events), []);
    assert.deepEqual(listDuplicateTradeIds(events), []);
  });

  it("buildClosedTradesFromEvents emits one closed trade when backfill duplicate exists", () => {
    const events = [
      evt({
        type: "ORDER_EXECUTED",
        tradeId: "trade-1",
        payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.011", orderId: "1", avgPrice: 100 },
      }),
      evt({
        type: "POSITION_OPENED",
        tradeId: "trade-1",
        payload: { qty: "0.011", entryPrice: 100 },
      }),
      evt({
        type: "CLOSE_ORDER_EXECUTED",
        tradeId: "trade-1",
        payload: { avgPrice: 101, executedQty: "0.011", orderId: "close-1", source: "BINANCE_TESTNET" },
      }),
      evt({
        type: "POSITION_CLOSED",
        tradeId: "trade-1",
        payload: { source: "RECONCILIATION_BACKFILL", closeOrderId: "reconcile-trade-1" },
      }),
      evt({
        type: "POSITION_CLOSED",
        tradeId: "trade-1",
        timestamp: "2026-06-12T00:00:02.000Z",
        payload: { source: "BINANCE_TESTNET", closeOrderId: "close-1" },
      }),
      evt({
        type: "PNL_REALIZED",
        tradeId: "trade-1",
        payload: {
          qty: "0.011",
          entryPrice: 100,
          exitPrice: 101,
          netPnl: 0.011,
          result: "WIN",
          side: "SHORT",
        },
      }),
    ];

    const closed = buildClosedTradesFromEvents(events);
    assert.equal(closed.length, 1);
    assert.equal(closed[0].closeOrderId, "close-1");
  });

  it("flags duplicate when two non-backfill closes exist", () => {
    const events = [
      evt({
        type: "POSITION_CLOSED",
        tradeId: "trade-dup",
        payload: { source: "BINANCE_TESTNET" },
      }),
      evt({
        type: "POSITION_CLOSED",
        tradeId: "trade-dup",
        timestamp: "2026-06-12T00:00:02.000Z",
        payload: { source: "BINANCE_TESTNET" },
      }),
    ];
    assert.deepEqual(listDuplicatePositionClosedTradeIds(events), ["trade-dup"]);
    assert.equal(pickCanonicalPositionClosed(events).payload.source, "BINANCE_TESTNET");
  });
});
