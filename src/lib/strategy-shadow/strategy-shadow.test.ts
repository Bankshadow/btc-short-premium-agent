import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAiTradeComparison,
  computeStrategyMetrics,
  evaluatePromotionEligibility,
  mapQuantTradeToShadow,
  tagCommitteeAlignment,
} from "./compute-metrics";
import type { StrategyShadowTrade } from "./types";
import { SHADOW_PROMOTION_RULES } from "./types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";

function makeTrade(overrides: Partial<StrategyShadowTrade>): StrategyShadowTrade {
  return {
    id: "t1",
    sourceType: "quant_import",
    strategyName: "MACD",
    sourceId: "macd-oscillator",
    symbol: "BTCUSDT",
    side: "SHORT",
    entryPrice: 100_000,
    virtualExit: 98_000,
    virtualPnL: 2,
    result: "WIN",
    createdAt: "2025-01-01T12:00:00.000Z",
    closedAt: "2025-01-02T12:00:00.000Z",
    advisoryOnly: true,
    executionBlocked: true,
    cannotCountAsLiveProof: true,
    ...overrides,
  };
}

describe("Strategy shadow (MVP 70)", () => {
  it("computes win rate and shadow PnL", () => {
    const trades = [
      makeTrade({ virtualPnL: 2, result: "WIN" }),
      makeTrade({ id: "t2", virtualPnL: -1, result: "LOSS" }),
      makeTrade({ id: "t3", virtualPnL: 1.5, result: "WIN" }),
    ];
    const metrics = computeStrategyMetrics(trades, "macd-oscillator");
    assert.ok(metrics);
    assert.equal(metrics.closedTrades, 3);
    assert.equal(metrics.winRate, 67);
    assert.equal(metrics.shadowPnL, 2.5);
  });

  it("tags false positive when quant trades but committee skips", () => {
    const trades = [makeTrade({ createdAt: "2025-01-01T12:00:00.000Z" })];
    const entries: DecisionLogEntry[] = [
      {
        id: "e1",
        timestamp: "2025-01-01T12:30:00.000Z",
        btcPrice: 100_000,
        marketRegime: "range",
        agentOutputs: [],
        finalVerdict: "SKIP",
        riskVeto: false,
        topReasons: [],
        actionPlan: "wait",
        outcomeStatus: "PENDING",
        paperPnl: null,
        reflection: null,
      },
    ];
    const tagged = tagCommitteeAlignment(trades, entries);
    assert.equal(tagged[0]?.falsePositive, true);
    assert.equal(tagged[0]?.falseNegative, false);
  });

  it("blocks promotion below minimum sample size", () => {
    const metrics = computeStrategyMetrics(
      [makeTrade({})],
      "macd-oscillator",
    )!;
    const { eligible, blockers } = evaluatePromotionEligibility(metrics);
    assert.equal(eligible, false);
    assert.ok(blockers[0]?.includes(String(SHADOW_PROMOTION_RULES.minSampleSize)));
  });

  it("compares shadow vs AI paper trades", () => {
    const shadowTrades = [
      makeTrade({ virtualPnL: 2 }),
      makeTrade({ id: "t2", virtualPnL: -0.5, result: "LOSS" }),
    ];
    const comparison = buildAiTradeComparison({
      shadowTrades,
      aiTrades: [
        {
          id: "o1",
          decisionLogId: "e1",
          committeeVerdict: "TRADE",
          instrument: "sell_call",
          symbol: "BTCUSDT",
          side: "short",
          entryBtcPrice: 100_000,
          notionalUsd: 50,
          status: "CLOSED",
          openedAt: "2025-01-01",
          closedAt: "2025-01-02",
          realizedPnlPct: 1,
          openedBy: "committee_auto",
        },
      ],
      quantMetrics: [],
    });
    assert.ok(comparison);
    assert.equal(comparison.aiSampleSize, 1);
    assert.ok(comparison.summary.length > 0);
  });

  it("maps quant backtest trade to shadow record", () => {
    const trade = mapQuantTradeToShadow({
      sourceId: "rsi-pattern-recognition",
      strategyName: "RSI",
      symbol: "BTCUSDT",
      importStatus: "RESEARCH_ONLY",
      direction: "LONG",
      entryPrice: 90_000,
      exitPrice: 92_000,
      netPnlPct: 2.1,
      entryTime: "2025-01-01T00:00:00.000Z",
      exitTime: "2025-01-02T00:00:00.000Z",
    });
    assert.equal(trade.executionBlocked, true);
    assert.equal(trade.cannotCountAsLiveProof, true);
    assert.equal(trade.result, "WIN");
  });
});
