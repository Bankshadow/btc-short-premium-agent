import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { TestnetLearningRecord } from "@/lib/testnet-monitor/types";
import { buildAgentScoreboardV2FromSamples } from "./build-agent-scoreboard-v2";
import { buildConfidenceCalibrationReport } from "./build-calibration-report";
import { collectTestnetCalibrationSamples } from "./collect-testnet-samples";

function journal(): BinanceTestnetJournalEntry {
  return {
    binanceTestnetTradeId: "tn-1",
    symbol: "BTCUSDT",
    side: "SELL",
    quantity: "0.01",
    status: "CLOSED",
    createdAt: new Date().toISOString(),
    closedAt: new Date().toISOString(),
    realizedPnl: 15,
    notionalUsd: 500,
    decisionLogId: "log-1",
    blockReasons: [],
    source: "AUTO_TESTNET",
  } as BinanceTestnetJournalEntry;
}

function decision(): DecisionLogEntry {
  return {
    id: "log-1",
    timestamp: new Date().toISOString(),
    btcPrice: 65000,
    marketRegime: "TREND_UP",
    agentOutputs: [],
    finalVerdict: "TRADE",
    riskVeto: false,
    topReasons: [],
    actionPlan: "Enter",
    playbookConfidence: 85,
  } as DecisionLogEntry;
}

function learningRecord(): TestnetLearningRecord {
  return {
    learningRecordId: "lrn-1",
    environment: "TESTNET",
    tradeId: "tn-1",
    closedTradeId: "tn-1",
    symbol: "BTCUSDT",
    side: "SELL",
    decisionLogId: "log-1",
    previewId: null,
    orderId: null,
    positionId: null,
    strategy: "AUTO_TESTNET",
    strategyTag: "AUTO_TESTNET",
    sourceAgent: "Committee Agent",
    finalVerdict: "TRADE",
    aiVerdict: "TRADE",
    confidence: 0.85,
    entryReason: "Setup",
    closeReason: null,
    whatWorked: null,
    whatFailed: null,
    suggestedAdjustment: null,
    grossPnl: 15,
    netPnl: 15,
    fee: 0,
    rMultiple: 1,
    maxFavorableExcursion: 15,
    maxAdverseExcursion: 0,
    durationMs: 1000,
    result: "WIN",
    includeInLearning: true,
    status: "LEARNED",
    reflectionNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("Integrated confidence calibration (MVP 77)", () => {
  it("collects samples from closed testnet trades with decision confidence", () => {
    const samples = collectTestnetCalibrationSamples({
      journal: [journal()],
      closedTrades: [
        {
          id: "tn-1",
          exchange: "BINANCE",
          symbol: "BTCUSDT",
          side: "SHORT",
          entryPrice: 0,
          exitPrice: 0,
          qty: "0.01",
          grossPnl: 15,
          fee: 0,
          netPnl: 15,
          rMultiple: 1,
          result: "WIN",
          durationMs: 1000,
          decisionLogId: "log-1",
          strategy: "AUTO_TESTNET",
          aiVerdict: null,
          confidence: null,
          openedAt: new Date().toISOString(),
          closedAt: new Date().toISOString(),
          notes: null,
          learned: false,
          previewId: null,
        },
      ],
      decisions: [decision()],
      learningRecords: [learningRecord()],
    });
    assert.equal(samples.length, 1);
    assert.equal(samples[0].confidenceBeforeTrade, 85);
    assert.equal(samples[0].actualWin, true);
    assert.equal(samples[0].sourceAgent, "Committee Agent");
  });

  it("detects overconfidence when high confidence meets losses", () => {
    const samples = [
      {
        sampleId: "a",
        decisionLogId: "1",
        tradeId: "t1",
        confidenceBeforeTrade: 90,
        actualWin: false,
        pnlPct: -2,
        result: "LOSS" as const,
        source: "testnet_closed",
        evaluatedAt: new Date().toISOString(),
        strategyTag: "AUTO_TESTNET",
        marketRegime: "TREND_UP",
        qualityScore: 50,
        sourceAgent: "Agent A",
      },
      {
        sampleId: "b",
        decisionLogId: "2",
        tradeId: "t2",
        confidenceBeforeTrade: 88,
        actualWin: false,
        pnlPct: -1.5,
        result: "LOSS" as const,
        source: "testnet_closed",
        evaluatedAt: new Date().toISOString(),
        strategyTag: "AUTO_TESTNET",
        marketRegime: "TREND_UP",
        qualityScore: 45,
        sourceAgent: "Agent A",
      },
      {
        sampleId: "c",
        decisionLogId: "3",
        tradeId: "t3",
        confidenceBeforeTrade: 92,
        actualWin: false,
        pnlPct: -3,
        result: "LOSS" as const,
        source: "testnet_closed",
        evaluatedAt: new Date().toISOString(),
        strategyTag: "AUTO_TESTNET",
        marketRegime: "TREND_UP",
        qualityScore: 40,
        sourceAgent: "Agent A",
      },
    ];
    const report = buildConfidenceCalibrationReport({ samples });
    assert.equal(report.overconfidenceDetected, true);
    assert.ok(report.recommendedSizeMultiplier <= 1);
    assert.equal(report.autoAgentWeightChangeAllowed, false);
    assert.equal(report.cannotIncreaseLiveRisk, true);
    assert.ok(report.affectedAgents.length > 0);
    assert.ok(report.affectedStrategies.length > 0);

    const v2 = buildAgentScoreboardV2FromSamples({ samples, report });
    assert.equal(v2.totalSamples, 3);
    assert.ok(v2.rows[0].calibrationGap > 0);
  });
});
