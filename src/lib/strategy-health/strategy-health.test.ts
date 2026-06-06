import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import { buildStrategyHealthSignal, buildStrategyHealthSummary } from "./build-strategy-health-summary";

function entry(id: string, overrides?: Partial<DecisionLogEntry>): DecisionLogEntry {
  return {
    id,
    timestamp: "2026-01-01T00:00:00.000Z",
    btcPrice: 100_000,
    marketRegime: "quiet_range",
    agentOutputs: [
      {
        agentName: "Options Strategy Agent",
        recommendation: "TRADE",
        strategyType: "OPTIONS",
        confidence: "HIGH",
        marketView: "range",
        reasons: ["premium rich"],
        risks: [],
        proposedAction: "sell call spread",
        missingData: [],
      },
    ],
    finalVerdict: "TRADE",
    riskVeto: false,
    topReasons: [],
    actionPlan: "trade",
    outcomeStatus: "RESOLVED",
    paperPnl: 0.6,
    reflection: null,
    resolution: {
      btcPriceAfter: 101_000,
      tradeWouldWin: true,
      notes: "ok",
      resolvedAt: "2026-01-01T01:00:00.000Z",
      outcomeLabel: "WIN",
    },
    ...overrides,
  };
}

function order(id: string, overrides?: Partial<PaperOrder>): PaperOrder {
  return {
    id,
    decisionLogId: "e1",
    committeeVerdict: "TRADE",
    instrument: "sell_call",
    symbol: "BTCUSDT",
    side: "short",
    entryBtcPrice: 100_000,
    entryOptionMark: null,
    strike: null,
    sizePct: 1,
    notionalUsd: 100,
    status: "CLOSED",
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: "2026-01-01T01:00:00.000Z",
    exitBtcPrice: 99_500,
    realizedPnlPct: 0.5,
    unrealizedPnlPct: null,
    lastMarkAt: null,
    lastMarkBtcPrice: null,
    openedBy: "committee_auto",
    notes: "",
    ...overrides,
  };
}

function liveTrade(id: string, overrides?: Partial<LiveTradeJournalEntry>): LiveTradeJournalEntry {
  return {
    liveTradeId: id,
    sourceSignalId: null,
    decisionLogId: "e1",
    previewId: "p1",
    confirmTokenId: "token",
    exchangeOrderId: "x1",
    status: "CLOSED",
    symbol: "BTCUSDT",
    side: "Sell",
    entry: {
      price: 100_000,
      qty: 0.001,
      notionalUsd: 100,
      side: "Sell",
      symbol: "BTCUSDT",
      timestamp: "2026-01-01T00:00:00.000Z",
    },
    exit: {
      price: 99_000,
      qty: 0.001,
      notionalUsd: 99,
      side: "Buy",
      timestamp: "2026-01-01T01:00:00.000Z",
      reduceOnly: true,
    },
    realizedPnl: 1,
    fees: 0.1,
    slippage: 0,
    operatorApproval: true,
    operatorApprovalNote: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    executedAt: "2026-01-01T00:01:00.000Z",
    closedAt: "2026-01-01T01:00:00.000Z",
    error: null,
    pilotMode: "LIVE_TESTNET",
    ...overrides,
  };
}

describe("strategy health", () => {
  it("builds per-environment metrics and recommendation", () => {
    const summary = buildStrategyHealthSummary({
      entries: [
        entry("e1"),
        entry("e2", {
          paperPnl: -0.4,
          marketRegime: "bear_trend",
          resolution: {
            btcPriceAfter: 98_000,
            tradeWouldWin: false,
            notes: "loss",
            resolvedAt: "2026-01-02T01:00:00.000Z",
            outcomeLabel: "LOSS",
          },
          falseTradeFlag: true,
        }),
      ],
      orders: [
        order("o1"),
        order("o2", { paperMode: "RELAXED_PAPER", realizedPnlPct: -0.2 }),
      ],
      testnetSnapshot: {
        closedTrades: [
          {
            id: "tn1",
            exchange: "BINANCE",
            symbol: "BTCUSDT",
            side: "SHORT",
            entryPrice: 100_000,
            exitPrice: 99_500,
            qty: "0.001",
            grossPnl: 0.5,
            fee: 0.1,
            netPnl: 0.4,
            rMultiple: 0.4,
            result: "WIN",
            durationMs: 3_600_000,
            decisionLogId: "e1",
            strategy: "options_short_premium",
            aiVerdict: "TRADE",
            confidence: 0.7,
            openedAt: "2026-01-03T00:00:00.000Z",
            closedAt: "2026-01-03T01:00:00.000Z",
            notes: null,
            learned: true,
            previewId: "p1",
          },
        ],
      } as never,
      liveTrades: [liveTrade("l1")],
    });

    const row = summary.rows.find((r) => r.strategyId === "options_short_premium");
    const liveMapped = summary.rows.find((r) => r.environmentMetrics.LIVE.sampleSize > 0);
    assert.ok(row);
    assert.ok(liveMapped);
    assert.ok((row?.environmentMetrics.PAPER.sampleSize ?? 0) >= 2);
    assert.ok((row?.environmentMetrics.SHADOW.sampleSize ?? 0) >= 1);
    assert.ok((row?.environmentMetrics.TESTNET.sampleSize ?? 0) >= 1);
    assert.ok((row?.falseTradeCount ?? 0) >= 1);
    assert.ok(row?.recommendation);
  });

  it("builds health signal for integrations", () => {
    const summary = buildStrategyHealthSummary({
      entries: [entry("e1"), entry("e2")],
      orders: [order("o1"), order("o2")],
    });
    const signal = buildStrategyHealthSignal(summary);
    assert.equal(signal.totalStrategies, summary.totals.strategies);
    assert.ok(signal.healthScorePct >= 0);
    assert.ok(signal.healthScorePct <= 100);
  });
});
