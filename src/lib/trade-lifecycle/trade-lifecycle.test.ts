import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UnifiedLedgerSnapshot } from "@/lib/ledger/types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import { buildTradeLifecycleTimeline } from "./build-trade-lifecycle-timeline";

function sampleLedger(): UnifiedLedgerSnapshot {
  const ts = "2026-06-01T00:00:00.000Z";
  return {
    workspaceId: "ws-1",
    generatedAt: ts,
    health: {
      healthy: true,
      entryCount: 2,
      liveEntryCount: 0,
      orphanTrades: 0,
      missingHashes: 0,
      duplicateLegacyRefs: 0,
      brokenLinks: 0,
      issues: [],
      lastSyncedAt: ts,
    },
    entries: [
      {
        ledgerEntryId: "led-decision-1",
        workspaceId: "ws-1",
        entryKind: "DECISION",
        sourceType: "AI",
        environment: "TESTNET",
        linkedDecisionId: "dec-1",
        linkedTradeId: null,
        linkedOrderId: null,
        linkedRunId: "run-1",
        timestamp: ts,
        payload: {
          decision: {
            id: "dec-1",
            timestamp: ts,
            btcPrice: 100000,
            marketRegime: "bull",
            agentOutputs: [],
            finalVerdict: "TRADE",
            riskVeto: false,
            topReasons: ["signal"],
            actionPlan: "execute",
            outcomeStatus: "PENDING",
            paperPnl: null,
            reflection: null,
          },
        },
        hash: "h1",
        lifecycleStage: "SIGNAL",
        asset: "BTCUSDT",
        strategy: "ai_signal",
        assetClass: "binance_testnet",
      },
      {
        ledgerEntryId: "led-trade-1",
        workspaceId: "ws-1",
        entryKind: "TRADE",
        sourceType: "EXCHANGE",
        environment: "TESTNET",
        linkedDecisionId: "dec-1",
        linkedTradeId: "bn-1",
        linkedOrderId: "ord-1",
        linkedRunId: null,
        timestamp: "2026-06-01T00:01:00.000Z",
        payload: {
          binanceTestnet: {
            binanceTestnetTradeId: "bn-1",
            previewId: "prev-1",
            symbol: "BTCUSDT",
            side: "BUY",
            notionalUsd: 100,
            quantity: "0.001",
            status: "SUBMITTED",
            source: "ai_signal",
            reason: "test",
            decisionLogId: "dec-1",
            exchangeOrderId: "ord-1",
            clientOrderId: null,
            operatorNote: null,
            blockReasons: [],
            createdAt: "2026-06-01T00:01:00.000Z",
            executedAt: "2026-06-01T00:01:00.000Z",
            closedAt: null,
            realizedPnl: null,
            fees: null,
          } satisfies BinanceTestnetJournalEntry,
        },
        hash: "h2",
        lifecycleStage: "MONITORING",
        asset: "BTCUSDT",
        strategy: "ai_signal",
        assetClass: "binance_testnet",
      },
    ],
    tradeTimelines: [
      {
        tradeId: "bn-1",
        decisionId: "dec-1",
        runId: "run-1",
        environment: "TESTNET",
        asset: "BTCUSDT",
        strategy: "ai_signal",
        assetClass: "binance_testnet",
        currentStage: "MONITORING",
        events: [],
      },
    ],
  };
}

describe("Trade Lifecycle Timeline", () => {
  it("builds timeline with required event fields", () => {
    const ledger = sampleLedger();
    const timeline = buildTradeLifecycleTimeline({
      lookupId: "bn-1",
      ledger: {
        ...ledger,
        tradeTimelines: [{ ...ledger.tradeTimelines[0], events: ledger.entries }],
      },
      binanceJournal: [
        {
          binanceTestnetTradeId: "bn-1",
          previewId: "prev-1",
          symbol: "BTCUSDT",
          side: "BUY",
          notionalUsd: 100,
          quantity: "0.001",
          status: "SUBMITTED",
          source: "ai_signal",
          reason: "test",
          decisionLogId: "dec-1",
          exchangeOrderId: "ord-1",
          clientOrderId: null,
          operatorNote: null,
          blockReasons: [],
          createdAt: "2026-06-01T00:01:00.000Z",
          executedAt: "2026-06-01T00:01:00.000Z",
          closedAt: null,
          realizedPnl: null,
          fees: null,
        },
      ],
    });

    assert.ok(timeline);
    assert.equal(timeline?.tradeId, "bn-1");
    assert.ok((timeline?.events.length ?? 0) >= 4);

    const first = timeline!.events[0];
    assert.ok(typeof first.timestamp === "string");
    assert.ok(["AI", "USER", "SYSTEM", "EXCHANGE"].includes(first.actor));
    assert.ok(typeof first.summary === "string" && first.summary.length > 0);
    assert.ok(typeof first.payload === "object");
    assert.ok("decisionLogId" in first.linkedIds);
    assert.ok(["PASSED", "BLOCKED", "CAUTION", "UNKNOWN"].includes(first.riskStatus));
  });
});
