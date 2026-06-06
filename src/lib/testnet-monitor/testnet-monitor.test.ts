import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDecisionLinkage, mapBinanceSource } from "./decision-linkage";
import {
  calculateClosedTradePnl,
  calculateUnrealizedPnl,
  calculateWinRate,
  classifyTradeResult,
  groupPnlBySymbol,
} from "./pnl";
import type { TestnetClosedTrade } from "./types";

describe("Testnet Monitor", () => {
  it("calculates unrealized PnL for long and short", () => {
    assert.equal(
      calculateUnrealizedPnl({
        side: "LONG",
        qty: 1,
        entryPrice: 100,
        markPrice: 110,
      }),
      10,
    );
    assert.equal(
      calculateUnrealizedPnl({
        side: "SHORT",
        qty: 1,
        entryPrice: 100,
        markPrice: 90,
      }),
      10,
    );
  });

  it("classifies closed trade results", () => {
    assert.equal(classifyTradeResult(5), "WIN");
    assert.equal(classifyTradeResult(-2), "LOSS");
    assert.equal(classifyTradeResult(0), "BREAKEVEN");
  });

  it("calculates closed trade PnL with fees", () => {
    const pnl = calculateClosedTradePnl({
      entry: 100,
      exit: 110,
      side: "LONG",
      qty: 1,
      fees: 0.5,
    });
    assert.equal(pnl.grossPnl, 10);
    assert.equal(pnl.netPnl, 9.5);
  });

  it("builds decision linkage for missing decision", () => {
    const link = buildDecisionLinkage(null, null);
    assert.equal(link.linked, false);
    assert.ok(link.message?.includes("not linked"));
  });

  it("maps binance source and win rate", () => {
    assert.equal(mapBinanceSource("ai_signal"), "AI_SIGNAL");
    const trades: TestnetClosedTrade[] = [
      {
        id: "1",
        exchange: "BINANCE",
        symbol: "BTCUSDT",
        side: "LONG",
        entryPrice: 0,
        exitPrice: 0,
        qty: "1",
        grossPnl: 1,
        fee: 0,
        netPnl: 1,
        rMultiple: null,
        result: "WIN",
        durationMs: 1000,
        decisionLogId: null,
        strategy: null,
        aiVerdict: null,
        confidence: null,
        openedAt: "",
        closedAt: "",
        notes: null,
        learned: false,
        previewId: null,
      },
      {
        id: "2",
        exchange: "BINANCE",
        symbol: "BTCUSDT",
        side: "SHORT",
        entryPrice: 0,
        exitPrice: 0,
        qty: "1",
        grossPnl: -1,
        fee: 0,
        netPnl: -1,
        rMultiple: null,
        result: "LOSS",
        durationMs: 1000,
        decisionLogId: null,
        strategy: null,
        aiVerdict: null,
        confidence: null,
        openedAt: "",
        closedAt: "",
        notes: null,
        learned: false,
        previewId: null,
      },
    ];
    assert.equal(calculateWinRate(trades), 50);
    const grouped = groupPnlBySymbol(trades);
    assert.equal(grouped[0]?.label, "BTCUSDT");
  });
});
