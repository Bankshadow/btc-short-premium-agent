import assert from "node:assert/strict";
import test from "node:test";
import { buildExecutionQualitySummary } from "./build-execution-quality-summary";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";

function entry(
  id: string,
  patch?: Partial<BinanceTestnetJournalEntry>,
): BinanceTestnetJournalEntry {
  return {
    binanceTestnetTradeId: id,
    previewId: `p-${id}`,
    symbol: "BTCUSDT",
    side: "SELL",
    notionalUsd: 100,
    quantity: "0.001",
    status: "SUBMITTED",
    source: "ai_signal",
    reason: "test",
    decisionLogId: "d-1",
    exchangeOrderId: "123",
    clientOrderId: "coid",
    operatorNote: null,
    blockReasons: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    executedAt: "2026-01-01T00:00:02.000Z",
    closedAt: null,
    realizedPnl: null,
    fees: 0.2,
    previewPrice: 100_000,
    markPriceAtSubmit: 100_100,
    fillPrice: 100_120,
    slippage: 120,
    slippageBps: 12,
    latencyMs: 2_000,
    partialFill: false,
    duplicateSubmission: false,
    retryCount: 0,
    closeAttempt: false,
    closeFailed: false,
    ...patch,
  };
}

test("buildExecutionQualitySummary computes aggregate metrics", () => {
  const summary = buildExecutionQualitySummary({
    testnetJournal: [
      entry("a1"),
      entry("a2", {
        symbol: "ETHUSDT",
        slippageBps: 20,
        latencyMs: 3_000,
        retryCount: 1,
      }),
      entry("a3", {
        status: "FAILED",
        blockReasons: ["insufficient margin"],
        closeAttempt: true,
        closeFailed: true,
      }),
    ],
  });

  assert.equal(summary.failedOrderCount, 1);
  assert.equal(summary.closeFailureCount, 1);
  assert.equal(summary.retryCountTotal, 1);
  assert.ok(summary.averageSlippageBps > 0);
  assert.ok(summary.slippageBySymbol.length >= 2);
  assert.ok(summary.exchangeErrors.some((e) => e.error.includes("insufficient")));
});

test("buildExecutionQualitySummary sets FAIL gate on degraded quality", () => {
  const bad = buildExecutionQualitySummary({
    testnetJournal: [
      entry("b1", { status: "FAILED", slippageBps: 35, latencyMs: 12_000 }),
      entry("b2", { status: "FAILED", slippageBps: 40, latencyMs: 15_000 }),
      entry("b3", {
        status: "FAILED",
        closeAttempt: true,
        closeFailed: true,
        slippageBps: 30,
      }),
    ],
  });
  assert.equal(bad.liveQualityGate.blocksLiveReadiness, true);
  assert.equal(bad.liveQualityGate.status, "FAIL");
});

