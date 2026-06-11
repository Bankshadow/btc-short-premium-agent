import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { buildMissionProjection } from "@/lib/core/projections/mission-projection";
import { buildTradeProjection } from "@/lib/core/projections/trade-projection";
import { buildOpenTradesFromEvents, buildClosedTradesFromEvents } from "@/lib/trades/trade-store";
import { buildAllProjections, clearProjectionCache } from "@/lib/core/projection-engine";
import type { JournalEvent } from "@/lib/journal/journal-types";

describe("Projection engine (Slice 3)", () => {
  it("mission projection matches legacy buildMissionSnapshot", () => {
    const events: JournalEvent[] = [
      {
        eventId: "evt-1",
        type: "PNL_REALIZED",
        timestamp: "2026-06-06T12:00:00.000Z",
        environment: "testnet",
        tradeId: "trade-1",
        payload: { netPnl: 5, result: "WIN" },
      },
    ];
    const legacy = buildMissionSnapshot(events);
    const core = buildMissionProjection(events);
    assert.equal(core.currentEquity, legacy.currentEquity);
    assert.equal(core.netPnl, legacy.netPnl);
    assert.equal(core.totalTrades, legacy.totalTrades);
  });

  it("trade projection matches legacy trade-store builders", () => {
    const events: JournalEvent[] = [
      {
        eventId: "evt-2",
        type: "ORDER_EXECUTED",
        timestamp: "2026-06-06T12:00:00.000Z",
        environment: "testnet",
        tradeId: "trade-open",
        previewId: "prev-1",
        payload: { symbol: "BTCUSDT", side: "SELL" },
      },
      {
        eventId: "evt-3",
        type: "POSITION_OPENED",
        timestamp: "2026-06-06T12:00:01.000Z",
        environment: "testnet",
        tradeId: "trade-open",
        payload: { symbol: "BTCUSDT", side: "SELL", qty: "0.001" },
      },
    ];
    const core = buildTradeProjection(events);
    const legacyOpen = buildOpenTradesFromEvents(events);
    const legacyClosed = buildClosedTradesFromEvents(events);
    assert.equal(core.open.length, legacyOpen.length);
    assert.equal(core.closed.length, legacyClosed.length);
  });

  it("zero-state mission projection", () => {
    const p = buildAllProjections([]);
    assert.equal(p.mission.currentEquity, 1000);
    assert.equal(p.trades.open.length, 0);
  });

  it("projection cache invalidates on new event id", () => {
    clearProjectionCache();
    const e1: JournalEvent[] = [
      {
        eventId: "evt-a",
        type: "ANALYSIS_STARTED",
        timestamp: "2026-06-06T10:00:00.000Z",
        environment: "testnet",
        runId: "run-1",
        payload: {},
      },
    ];
    const first = buildAllProjections(e1);
    const second = buildAllProjections([
      ...e1,
      {
        eventId: "evt-b",
        type: "VERDICT_CREATED",
        timestamp: "2026-06-06T10:00:01.000Z",
        environment: "testnet",
        runId: "run-1",
        payload: { verdict: "WAIT", confidence: 50, reasons: [] },
      },
    ]);
    assert.notEqual(first.meta.cacheKey, second.meta.cacheKey);
  });
});
