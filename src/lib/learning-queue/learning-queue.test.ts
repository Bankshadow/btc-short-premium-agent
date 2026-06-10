import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { TestnetLearningRecord } from "@/lib/testnet-monitor/types";
import { buildLearningProgress, isClosedJournalEntry } from "./build-learning-progress";
import { detectRecurringMistakes } from "./detect-recurring-mistakes";

function journalEntry(
  partial: Partial<BinanceTestnetJournalEntry> & Pick<BinanceTestnetJournalEntry, "symbol">,
): BinanceTestnetJournalEntry {
  return {
    binanceTestnetTradeId: partial.binanceTestnetTradeId ?? "bn-tn-1",
    previewId: partial.previewId ?? "prev-1",
    symbol: partial.symbol,
    side: partial.side ?? "BUY",
    notionalUsd: 100,
    quantity: "0.01",
    status: partial.status ?? "CLOSED",
    source: "ai_signal",
    reason: "committee TRADE",
    decisionLogId: partial.decisionLogId ?? "dl-1",
    exchangeOrderId: null,
    clientOrderId: null,
    operatorNote: partial.operatorNote ?? null,
    blockReasons: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    executedAt: "2026-01-01T00:00:00.000Z",
    closedAt: partial.closedAt ?? "2026-01-01T01:00:00.000Z",
    realizedPnl: partial.realizedPnl ?? 1.5,
    fees: 0.1,
    closeAttempt: false,
    closeFailed: false,
    ...partial,
  };
}

function learningRecord(
  partial: Partial<TestnetLearningRecord> & Pick<TestnetLearningRecord, "symbol">,
): TestnetLearningRecord {
  const tradeId = partial.tradeId ?? partial.closedTradeId ?? "bn-tn-1";
  return {
    learningRecordId: partial.learningRecordId ?? "lrn-1",
    environment: "TESTNET",
    tradeId,
    symbol: partial.symbol,
    side: partial.side ?? "LONG",
    decisionLogId: partial.decisionLogId ?? "dl-1",
    previewId: "prev-1",
    orderId: null,
    positionId: null,
    closedTradeId: tradeId,
    strategy: "ai_signal",
    strategyTag: "ai_signal",
    sourceAgent: "AI_SIGNAL",
    finalVerdict: "TRADE",
    aiVerdict: "TRADE",
    confidence: 0.7,
    entryReason: "committee TRADE",
    closeReason: partial.closeReason ?? "Take profit",
    whatWorked: null,
    whatFailed: null,
    suggestedAdjustment: null,
    grossPnl: 1.6,
    netPnl: partial.netPnl ?? 1.5,
    fee: 0.1,
    rMultiple: 1.5,
    maxFavorableExcursion: 1.6,
    maxAdverseExcursion: 0,
    durationMs: 3600000,
    result: partial.result ?? "WIN",
    includeInLearning: true,
    status: partial.status ?? "PENDING_REVIEW",
    reflectionNotes: null,
    createdAt: partial.createdAt ?? "2026-01-01T01:00:00.000Z",
    updatedAt: "2026-01-01T01:00:00.000Z",
    ...partial,
  };
}

describe("Learning queue (MVP 73C)", () => {
  it("detects CLOSED journal entries", () => {
    assert.equal(isClosedJournalEntry(journalEntry({ symbol: "BTCUSDT" })), true);
    assert.equal(
      isClosedJournalEntry(
        journalEntry({ symbol: "ETHUSDT", status: "FILLED", closedAt: null, realizedPnl: null }),
      ),
      false,
    );
  });

  it("builds progress with pending and learned counts", () => {
    const journal = [
      journalEntry({ binanceTestnetTradeId: "t1", symbol: "BTCUSDT" }),
      journalEntry({ binanceTestnetTradeId: "t2", symbol: "ETHUSDT" }),
    ];
    const records = [
      learningRecord({
        tradeId: "t1",
        closedTradeId: "t1",
        symbol: "BTCUSDT",
        status: "LEARNED",
      }),
      learningRecord({
        tradeId: "t2",
        closedTradeId: "t2",
        symbol: "ETHUSDT",
        learningRecordId: "lrn-2",
        status: "PENDING_REVIEW",
      }),
    ];
    const progress = buildLearningProgress({ journal, learningRecords: records });
    assert.equal(progress.closedJournalCount, 2);
    assert.equal(progress.learnedCount, 1);
    assert.equal(progress.pendingCount, 1);
    assert.equal(progress.progressPct, 50);
    assert.equal(progress.autoStrategyAdjustmentAllowed, false);
  });

  it("flags missing learning records for closed journals", () => {
    const journal = [journalEntry({ binanceTestnetTradeId: "t1", symbol: "BTCUSDT" })];
    const progress = buildLearningProgress({ journal, learningRecords: [] });
    assert.match(progress.nextExpectedAction, /lack records/i);
  });

  it("detects consecutive loss streak", () => {
    const mistakes = detectRecurringMistakes([
      learningRecord({
        symbol: "SOLUSDT",
        tradeId: "a",
        closedTradeId: "a",
        result: "LOSS",
        netPnl: -2,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      learningRecord({
        symbol: "SOLUSDT",
        tradeId: "b",
        closedTradeId: "b",
        learningRecordId: "lrn-b",
        result: "LOSS",
        netPnl: -1,
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
    ]);
    assert.ok(mistakes.some((m) => m.kind === "loss_streak"));
  });

  it("never auto-suggests strategy adjustment in new records", () => {
    const record = learningRecord({ symbol: "BTCUSDT" });
    assert.equal(record.suggestedAdjustment, null);
  });
});
