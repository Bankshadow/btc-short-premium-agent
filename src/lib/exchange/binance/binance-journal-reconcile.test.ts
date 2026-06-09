import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BinanceTestnetJournalEntry } from "./binance-types";
import {
  computeCloseRealizedPnl,
  findOpenJournalEntryForSymbol,
  reconcileBinanceJournalStatuses,
} from "./binance-journal-reconcile";

function entry(
  partial: Partial<BinanceTestnetJournalEntry> & Pick<BinanceTestnetJournalEntry, "symbol" | "status">,
): BinanceTestnetJournalEntry {
  return {
    binanceTestnetTradeId: partial.binanceTestnetTradeId ?? "bn-tn-1",
    previewId: "prev-1",
    symbol: partial.symbol,
    side: partial.side ?? "BUY",
    notionalUsd: 100,
    quantity: partial.quantity ?? "0.01",
    status: partial.status,
    source: "ai_signal",
    reason: "test",
    decisionLogId: null,
    exchangeOrderId: null,
    clientOrderId: null,
    operatorNote: null,
    blockReasons: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    executedAt: "2026-01-01T00:00:00.000Z",
    closedAt: null,
    realizedPnl: null,
    fees: null,
    previewPrice: 100,
    markPriceAtSubmit: null,
    fillPrice: 100,
    slippage: null,
    slippageBps: null,
    latencyMs: null,
    partialFill: false,
    duplicateSubmission: false,
    retryCount: 0,
    closeAttempt: false,
    closeFailed: false,
    ...partial,
  };
}

describe("computeCloseRealizedPnl", () => {
  it("computes long PnL", () => {
    assert.equal(
      computeCloseRealizedPnl({
        side: "BUY",
        quantity: "1",
        entryPrice: 100,
        exitPrice: 110,
      }),
      10,
    );
  });

  it("computes short PnL", () => {
    assert.equal(
      computeCloseRealizedPnl({
        side: "SELL",
        quantity: "1",
        entryPrice: 100,
        exitPrice: 90,
      }),
      10,
    );
  });
});

describe("reconcileBinanceJournalStatuses", () => {
  it("finalizes CLOSING to CLOSED when position is gone", () => {
    const journal = [
      entry({
        symbol: "BTCUSDT",
        status: "CLOSING",
        side: "BUY",
        quantity: "0.01",
        markPriceAtSubmit: 105,
        fillPrice: 100,
        realizedPnl: 0.05,
      }),
    ];
    const next = reconcileBinanceJournalStatuses(journal, []);
    assert.equal(next[0]?.status, "CLOSED");
    assert.equal(next[0]?.realizedPnl, 0.05);
    assert.ok(next[0]?.closedAt);
  });
});

describe("findOpenJournalEntryForSymbol", () => {
  it("ignores legacy -close duplicate rows", () => {
    const journal = [
      entry({ symbol: "ETHUSDT", status: "FILLED", binanceTestnetTradeId: "bn-tn-open" }),
      entry({
        symbol: "ETHUSDT",
        status: "CLOSING",
        binanceTestnetTradeId: "bn-tn-open-close",
      }),
    ];
    assert.equal(
      findOpenJournalEntryForSymbol(journal, "ETHUSDT")?.binanceTestnetTradeId,
      "bn-tn-open",
    );
  });
});
