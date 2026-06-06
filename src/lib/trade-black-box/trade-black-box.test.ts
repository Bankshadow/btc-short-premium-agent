import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UnifiedLedgerSnapshot } from "@/lib/ledger/types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { buildTradeBlackBox } from "./build-black-box";
import { buildDebugPack } from "./export-debug-pack";
import { failureCategoryLabel, inferFailureCause, inferOutcomeStatus } from "./infer-failure-cause";
import { sanitizeRecordValue } from "./sanitize-record";
import type { TradeBlackBoxSections, TradeBlackBoxTimelineEntry } from "./types";

function sampleDecision(): DecisionLogEntry {
  return {
    id: "dec-1",
    timestamp: "2026-06-01T00:00:00.000Z",
    btcPrice: 100000,
    marketRegime: "bull",
    agentOutputs: [
      {
        agentName: "Risk Manager",
        recommendation: "SKIP",
        strategyType: "RISK",
        confidence: "HIGH",
        marketView: "elevated risk",
        reasons: ["volatility"],
        risks: ["gap"],
        proposedAction: "wait",
        veto: true,
        vetoReasons: ["max exposure"],
      },
    ],
    finalVerdict: "TRADE",
    riskVeto: true,
    topReasons: ["signal strong"],
    actionPlan: "execute small",
    outcomeStatus: "PENDING",
    paperPnl: null,
    reflection: null,
  };
}

function sampleLedger(): UnifiedLedgerSnapshot {
  const ts = "2026-06-01T00:00:00.000Z";
  const decision = sampleDecision();
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
        payload: { decision },
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
            status: "BLOCKED",
            source: "ai_signal",
            reason: "test",
            decisionLogId: "dec-1",
            exchangeOrderId: null,
            clientOrderId: null,
            operatorNote: null,
            blockReasons: ["risk gate"],
            createdAt: "2026-06-01T00:01:00.000Z",
            executedAt: null,
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

describe("Trade Black Box", () => {
  it("redacts secret keys and values", () => {
    const sanitized = sanitizeRecordValue({
      apiKey: "super-secret-key",
      nested: { BINANCE_API_SECRET: "abc123" },
      note: "api_key=leaked-value",
    });
    assert.equal(sanitized.apiKey, "[redacted]");
    assert.equal((sanitized.nested as { BINANCE_API_SECRET: string }).BINANCE_API_SECRET, "[redacted]");
    assert.match(String(sanitized.note), /\[redacted\]/);
  });

  it("infers AI veto failure cause", () => {
    const sections: TradeBlackBoxSections = {
      marketSnapshot: null,
      aiDecision: { riskVeto: true, topReasons: ["strong signal"] },
      agentVotes: null,
      riskChecks: null,
      preview: null,
      orderRequest: null,
      exchangeResponse: null,
      positionUpdates: null,
      closeEvent: null,
      pnl: null,
      reflection: null,
    };
    const timeline: TradeBlackBoxTimelineEntry[] = [];
    const outcome = inferOutcomeStatus({ sections, timeline });
    const cause = inferFailureCause({ sections, timeline, outcomeStatus: outcome });
    assert.equal(cause.category, "AI_VETO");
    assert.equal(cause.severity, "HIGH");
    assert.equal(failureCategoryLabel(cause.category), "AI veto");
  });

  it("builds black box record with required sections", () => {
    const ledger = sampleLedger();
    const record = buildTradeBlackBox({
      lookupId: "bn-1",
      ledger: {
        ...ledger,
        tradeTimelines: [{ ...ledger.tradeTimelines[0], events: ledger.entries }],
      },
      decision: sampleDecision(),
      binanceJournal: [
        {
          binanceTestnetTradeId: "bn-1",
          previewId: "prev-1",
          symbol: "BTCUSDT",
          side: "BUY",
          notionalUsd: 100,
          quantity: "0.001",
          status: "BLOCKED",
          source: "ai_signal",
          reason: "test",
          decisionLogId: "dec-1",
          exchangeOrderId: null,
          clientOrderId: null,
          operatorNote: null,
          blockReasons: ["risk gate"],
          createdAt: "2026-06-01T00:01:00.000Z",
          executedAt: null,
          closedAt: null,
          realizedPnl: null,
          fees: null,
        },
      ],
    });

    assert.ok(record);
    assert.equal(record?.tradeId, "bn-1");
    assert.ok(record?.sections.marketSnapshot);
    assert.ok(record?.sections.aiDecision);
    assert.ok(record?.sections.agentVotes?.length);
    assert.ok(record?.timeline.length >= 4);
    assert.notEqual(record?.failureCause.category, "NONE");
  });

  it("exports debug pack without secrets flag", () => {
    const ledger = sampleLedger();
    const record = buildTradeBlackBox({
      lookupId: "bn-1",
      ledger: {
        ...ledger,
        tradeTimelines: [{ ...ledger.tradeTimelines[0], events: ledger.entries }],
      },
      decision: sampleDecision(),
    });
    assert.ok(record);
    const pack = buildDebugPack(record!);
    assert.equal(pack.secretsRedacted, true);
    assert.equal(pack.packVersion, "mvp-85-v1");
    assert.equal(pack.tradeId, "bn-1");
  });
});
