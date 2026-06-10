import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import {
  buildEvidenceProgress,
  validateEvidenceJournalEntry,
} from "./build-evidence-progress";
import type { TestnetClosedTrade } from "@/lib/testnet-monitor/types";

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
    reason: "test",
    decisionLogId: partial.decisionLogId ?? "dl-1",
    exchangeOrderId: null,
    clientOrderId: null,
    operatorNote: partial.operatorNote ?? null,
    blockReasons: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    executedAt: "2026-01-01T00:00:00.000Z",
    closedAt: partial.closedAt ?? "2026-01-01T01:00:00.000Z",
    realizedPnl: partial.realizedPnl ?? 1.5,
    fees: null,
    previewPrice: 100,
    markPriceAtSubmit: 101,
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

describe("Evidence progress (MVP 73A)", () => {
  it("counts valid CLOSED trades with decisionLogId and PnL", () => {
    const journal = [
      journalEntry({ binanceTestnetTradeId: "t1", symbol: "BTCUSDT", realizedPnl: 2 }),
      journalEntry({ binanceTestnetTradeId: "t2", symbol: "ETHUSDT", previewId: "p2", realizedPnl: -1 }),
    ];
    const progress = buildEvidenceProgress({
      journal,
      closedTrades: [],
      learningRecords: [],
      openPositionCount: 0,
      connected: true,
      requiredTrades: 12,
    });
    assert.equal(progress.completedTrades, 2);
    assert.equal(progress.remainingTrades, 10);
    assert.equal(progress.winCount, 1);
    assert.equal(progress.lossCount, 1);
    assert.equal(progress.evidenceSetValid, true);
  });

  it("excludes trades without decisionLogId", () => {
    const journal = [
      journalEntry({
        binanceTestnetTradeId: "bad",
        symbol: "DOGEUSDT",
        decisionLogId: null,
      }),
    ];
    const progress = buildEvidenceProgress({
      journal,
      closedTrades: [],
      learningRecords: [],
      openPositionCount: 0,
      connected: true,
    });
    assert.equal(progress.completedTrades, 0);
    assert.equal(progress.missingDecisionLogId, 1);
    assert.equal(progress.excludedTradeCount, 1);
  });

  it("excludes duplicate previewId closes", () => {
    const seen = new Set<string>();
    const ids = new Set<string>();
    const first = validateEvidenceJournalEntry({
      journal: journalEntry({ previewId: "same-prev", binanceTestnetTradeId: "a" }),
      closedTrade: null,
      seenPreviewIds: seen,
      seenTradeIds: ids,
    });
    assert.equal(first.excluded, null);
    const second = validateEvidenceJournalEntry({
      journal: journalEntry({ previewId: "same-prev", binanceTestnetTradeId: "b", symbol: "LINKUSDT" }),
      closedTrade: null,
      seenPreviewIds: seen,
      seenTradeIds: ids,
    });
    assert.ok(second.excluded?.duplicate);
  });

  it("reports open positions as blocker toward 12", () => {
    const progress = buildEvidenceProgress({
      journal: [],
      closedTrades: [],
      learningRecords: [],
      openPositionCount: 3,
      connected: true,
    });
    assert.match(progress.currentBlocker ?? "", /3 open position/);
    assert.match(progress.nextExpectedAction, /Monitor 3/);
  });

  it("marks evidence set ready at 12 valid trades", () => {
    const journal = Array.from({ length: 12 }, (_, i) =>
      journalEntry({
        binanceTestnetTradeId: `t-${i}`,
        previewId: `p-${i}`,
        symbol: `SYM${i}USDT`,
        closedAt: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
      }),
    );
    const progress = buildEvidenceProgress({
      journal,
      closedTrades: [],
      learningRecords: [],
      openPositionCount: 0,
      connected: true,
    });
    assert.equal(progress.evidenceSetReady, true);
    assert.equal(progress.remainingTrades, 0);
  });

  it("flags monitor closed trade without CLOSED journal", () => {
    const closed: TestnetClosedTrade = {
      id: "orphan",
      exchange: "BINANCE",
      symbol: "SOLUSDT",
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
      decisionLogId: "dl-x",
      strategy: "ai_signal",
      aiVerdict: null,
      confidence: null,
      openedAt: "2026-01-01T00:00:00.000Z",
      closedAt: "2026-01-01T01:00:00.000Z",
      notes: null,
      learned: false,
      previewId: null,
    };
    const progress = buildEvidenceProgress({
      journal: [],
      closedTrades: [closed],
      learningRecords: [],
      openPositionCount: 0,
      connected: true,
    });
    assert.equal(progress.missingCloseJournal, 1);
  });
});
