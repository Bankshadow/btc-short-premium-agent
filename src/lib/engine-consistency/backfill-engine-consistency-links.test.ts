import assert from "node:assert/strict";
import test from "node:test";
import {
  backfillMissingDecisionLogIds,
} from "./backfill-engine-consistency-links";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";

function journal(partial: Partial<BinanceTestnetJournalEntry>): BinanceTestnetJournalEntry {
  return {
    binanceTestnetTradeId: "bn-1",
    previewId: "p1",
    symbol: "BTCUSDT",
    side: "SELL",
    notionalUsd: 100,
    quantity: "0.01",
    status: "CLOSED",
    source: "ai_desk",
    reason: "test",
    decisionLogId: null,
    exchangeOrderId: null,
    clientOrderId: null,
    operatorNote: null,
    blockReasons: [],
    createdAt: "2026-06-09T12:00:00.000Z",
    executedAt: "2026-06-09T12:01:00.000Z",
    closedAt: "2026-06-09T13:00:00.000Z",
    realizedPnl: 1,
    fees: 0.1,
    previewPrice: 100000,
    markPriceAtSubmit: 100000,
    fillPrice: 100000,
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

function decision(id: string, timestamp: string): DecisionLogEntry {
  return {
    id,
    timestamp,
    btcPrice: 100000,
    marketRegime: "neutral",
    agentOutputs: [],
    finalVerdict: "SKIP",
    riskVeto: false,
    topReasons: [],
    actionPlan: "",
    outcomeStatus: "PENDING",
    paperPnl: null,
    reflection: null,
  };
}

test("backfillMissingDecisionLogIds links nearest prior decision", () => {
  const { journal: next, linkedCount } = backfillMissingDecisionLogIds(
    [journal({})],
    [
      decision("dec-old", "2026-06-09T10:00:00.000Z"),
      decision("dec-near", "2026-06-09T11:59:00.000Z"),
    ],
  );
  assert.equal(linkedCount, 1);
  assert.equal(next[0].decisionLogId, "dec-near");
});

test("backfillMissingDecisionLogIds skips when already linked", () => {
  const { linkedCount } = backfillMissingDecisionLogIds(
    [journal({ decisionLogId: "existing" })],
    [decision("dec-near", "2026-06-09T11:59:00.000Z")],
  );
  assert.equal(linkedCount, 0);
});
