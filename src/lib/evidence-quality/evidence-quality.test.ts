import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEvidenceQualitySnapshot } from "./build-evidence-quality";
import {
  resolveEvidenceQualityLevel,
  resolveReadinessForStrategyReview,
} from "./resolve-evidence-quality";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type {
  TestnetClosedTrade,
  TestnetLearningRecord,
  TestnetMonitorJournalEvent,
} from "@/lib/testnet-monitor/types";
import type { TradeQualityScore } from "@/lib/trade-quality-score/types";

function closedJournal(
  overrides: Partial<BinanceTestnetJournalEntry> = {},
): BinanceTestnetJournalEntry {
  return {
    binanceTestnetTradeId: "trade-1",
    symbol: "BTCUSDT",
    side: "SELL",
    quantity: "0.01",
    status: "CLOSED",
    decisionLogId: "dl-1",
    realizedPnl: 12.5,
    fees: 0.5,
    fillPrice: 65000,
    markPriceAtSubmit: 64800,
    source: "btc-short-premium",
    executedAt: "2026-01-01T00:00:00.000Z",
    closedAt: "2026-01-01T01:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    previewId: "pv-1",
    operatorNote: null,
    ...overrides,
  } as BinanceTestnetJournalEntry;
}

function decision(): DecisionLogEntry {
  return {
    id: "dl-1",
    timestamp: "2026-01-01T00:00:00.000Z",
    btcPrice: 65000,
    marketRegime: "TREND",
    playbookConfidence: 72,
    agentOutputs: [],
    finalVerdict: "TRADE",
    riskVeto: false,
    topReasons: ["setup ok"],
    actionPlan: "short",
    outcomeStatus: "PENDING",
    paperPnl: null,
    reflection: null,
  };
}

function closedTrade(): TestnetClosedTrade {
  return {
    id: "trade-1",
    exchange: "BINANCE",
    symbol: "BTCUSDT",
    side: "SHORT",
    entryPrice: 65000,
    exitPrice: 64800,
    qty: "0.01",
    grossPnl: 13,
    fee: 0.5,
    netPnl: 12.5,
    rMultiple: null,
    result: "WIN",
    durationMs: 3600000,
    decisionLogId: "dl-1",
    strategy: "btc-short-premium",
    aiVerdict: "TRADE",
    confidence: 72,
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: "2026-01-01T01:00:00.000Z",
    notes: null,
    learned: true,
    previewId: "pv-1",
  };
}

function learningRecord(): TestnetLearningRecord {
  return {
    learningRecordId: "lr-1",
    tradeId: "trade-1",
    closedTradeId: "trade-1",
    symbol: "BTCUSDT",
    environment: "TESTNET",
    decisionLogId: "dl-1",
    strategyTag: "btc-short-premium",
    confidence: 72,
    aiVerdict: "TRADE",
    netPnl: 12.5,
    grossPnl: 13,
    fee: 0.5,
    result: "WIN",
    status: "LEARNED",
  } as TestnetLearningRecord;
}

function qualityScore(): TradeQualityScore {
  return {
    scoreId: "qs-1",
    tradeId: "trade-1",
    decisionLogId: "dl-1",
    generatedAt: "2026-01-01T01:00:00.000Z",
    source: "testnet",
    grade: "B",
    compositeScore: 78,
    dimensions: {
      setupQuality: 80,
      marketRegimeFit: 72,
      entryQuality: 75,
      exitQuality: 78,
      riskReward: 70,
      ruleCompliance: 85,
      executionQuality: 80,
      reasoningConsistency: 76,
    },
    primaryReason: "Solid process",
    improvements: [],
    pnlPct: 0.3,
    tradeWouldWin: true,
    safetyNotice: "Trade quality scores are advisory — they grade decision process, not authorization to trade. Poor grades may reduce mission confidence but cannot enable live risk.",
    advisoryOnly: true,
  };
}

function closedEvent(): TestnetMonitorJournalEvent {
  return {
    journalId: "ev-1",
    exchange: "BINANCE",
    environment: "TESTNET",
    eventType: "POSITION_CLOSED",
    symbol: "BTCUSDT",
    payload: { tradeId: "trade-1" },
    decisionLogId: "dl-1",
    orderId: null,
    positionId: null,
    timestamp: "2026-01-01T01:00:00.000Z",
  };
}

describe("evidence quality mvp89", () => {
  it("marks fully linked closed trade as valid evidence", () => {
    const snapshot = buildEvidenceQualitySnapshot({
      journal: [closedJournal()],
      closedTrades: [closedTrade()],
      learningRecords: [learningRecord()],
      decisions: [decision()],
      tradeQualityScores: [qualityScore()],
      monitorEvents: [closedEvent()],
    });

    assert.equal(snapshot.validEvidenceCount, 1);
    assert.equal(snapshot.invalidEvidenceCount, 0);
    assert.equal(snapshot.evidenceConfidence, 100);
    assert.equal(snapshot.trades[0]?.valid, true);
  });

  it("flags missing decisionLogId and trade quality score", () => {
    const snapshot = buildEvidenceQualitySnapshot({
      journal: [closedJournal({ decisionLogId: null })],
      closedTrades: [closedTrade({ decisionLogId: null })],
      learningRecords: [],
      decisions: [],
      tradeQualityScores: [],
      monitorEvents: [],
    });

    assert.equal(snapshot.validEvidenceCount, 0);
    assert.equal(snapshot.invalidEvidenceCount, 1);
    assert.ok(snapshot.missingFields.some((f) => f.field === "decisionLogId"));
    assert.ok(snapshot.missingFields.some((f) => f.field === "tradeQualityScore"));
    assert.equal(snapshot.blocksStrategyHealthReview, true);
  });

  it("resolves readiness only when quality is GOOD with zero invalid", () => {
    const level = resolveEvidenceQualityLevel({
      validEvidenceCount: 12,
      invalidEvidenceCount: 0,
      evidenceConfidence: 100,
    });
    assert.equal(level, "GOOD");
    assert.equal(
      resolveReadinessForStrategyReview({
        validEvidenceCount: 12,
        invalidEvidenceCount: 0,
        evidenceConfidence: 100,
        evidenceQualityLevel: level,
      }),
      true,
    );
  });
});
