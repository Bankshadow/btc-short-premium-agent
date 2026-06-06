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
import {
  buildAgentScoreboardSegmentFromRecords,
  buildStrategyPerformanceSegmentFromRecords,
  buildValidationMetricsSegmentFromRecords,
} from "./learning-records-server";
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

  it("builds TESTNET learning segments from learned records only", () => {
    const records = [
      {
        learningRecordId: "r1",
        environment: "TESTNET" as const,
        symbol: "BTCUSDT",
        decisionLogId: "d1",
        previewId: "p1",
        orderId: "o1",
        positionId: "pos-BTCUSDT-LONG",
        closedTradeId: "t1",
        strategy: "autopilot",
        sourceAgent: "AUTOPILOT",
        finalVerdict: "TRADE",
        confidence: 0.8,
        grossPnl: 20,
        netPnl: 19,
        fee: 1,
        rMultiple: 1.9,
        maxFavorableExcursion: 20,
        maxAdverseExcursion: 0,
        durationMs: 60_000,
        result: "WIN" as const,
        includeInLearning: true,
        status: "LEARNED" as const,
        reflectionNotes: "ok",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:10:00.000Z",
      },
      {
        learningRecordId: "r2",
        environment: "TESTNET" as const,
        symbol: "ETHUSDT",
        decisionLogId: "d2",
        previewId: "p2",
        orderId: "o2",
        positionId: "pos-ETHUSDT-SHORT",
        closedTradeId: "t2",
        strategy: "manual",
        sourceAgent: "MANUAL_TEST",
        finalVerdict: "TRADE",
        confidence: 0.4,
        grossPnl: -5,
        netPnl: -6,
        fee: 1,
        rMultiple: -0.6,
        maxFavorableExcursion: 0,
        maxAdverseExcursion: -5,
        durationMs: 90_000,
        result: "LOSS" as const,
        includeInLearning: false,
        status: "EXCLUDED" as const,
        reflectionNotes: null,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:10:00.000Z",
      },
    ];

    const agent = buildAgentScoreboardSegmentFromRecords(records);
    const strategy = buildStrategyPerformanceSegmentFromRecords(records);
    const validation = buildValidationMetricsSegmentFromRecords(records);

    assert.equal(agent.environment, "TESTNET");
    assert.equal(agent.totalLearned, 1);
    assert.equal(agent.rows[0]?.sourceAgent, "AUTOPILOT");
    assert.equal(strategy.totalLearned, 1);
    assert.equal(strategy.rows[0]?.strategy, "autopilot");
    assert.equal(validation.environment, "TESTNET");
    assert.equal(validation.totalClosedTrades, 2);
    assert.equal(validation.learnedCount, 1);
    assert.equal(validation.excludedFromLearning, 1);
  });
});
