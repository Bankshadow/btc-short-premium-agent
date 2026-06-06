import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import {
  buildLedgerEntriesFromSources,
  mapDecisionToLedger,
  mapPaperOrderToLedger,
} from "./build-from-sources";
import { evaluateLedgerHealth } from "./health";
import { hashLedgerPayload } from "./hash";
import { buildTradeTimelines } from "./timelines";
import type { LedgerSourceBundle } from "./types";

function sampleDecision(id: string): DecisionLogEntry {
  return {
    id,
    workspaceId: "ws-test",
    runId: `run-${id}`,
    timestamp: "2026-06-01T12:00:00.000Z",
    btcPrice: 65000,
    marketRegime: "Bearish",
    agentOutputs: [
      {
        agentName: "Options",
        strategyType: "short_premium",
        recommendation: "TRADE",
        confidence: 72,
        reasons: ["test"],
        risks: [],
      },
    ],
    finalVerdict: "TRADE",
    riskVeto: false,
    topReasons: ["test"],
    actionPlan: "paper",
    outcomeStatus: "RESOLVED",
    paperPnl: 1.2,
    reflection: null,
    resolution: {
      btcPriceAfter: 64000,
      tradeWouldWin: true,
      notes: "win",
      resolvedAt: "2026-06-02T12:00:00.000Z",
    },
  };
}

function sampleOrder(decisionLogId: string): PaperOrder {
  return {
    id: `order-${decisionLogId}`,
    workspaceId: "ws-test",
    decisionLogId,
    committeeVerdict: "TRADE",
    instrument: "short_call",
    symbol: "BTC",
    side: "short",
    entryBtcPrice: 65000,
    entryOptionMark: 1200,
    strike: 66000,
    sizePct: 2,
    notionalUsd: 200,
    status: "CLOSED",
    openedAt: "2026-06-01T12:05:00.000Z",
    closedAt: "2026-06-02T12:00:00.000Z",
    exitBtcPrice: 64000,
    realizedPnlPct: 1.2,
    unrealizedPnlPct: null,
    lastMarkAt: null,
    lastMarkBtcPrice: null,
    openedBy: "committee_auto",
    notes: "",
    paperMode: "STRICT_PAPER",
  };
}

describe("P-MVP 3 Unified Trading Ledger", () => {
  it("maps decision and paper order with shared links", () => {
    const decision = sampleDecision("dec-1");
    const order = sampleOrder("dec-1");
    const bundle: LedgerSourceBundle = {
      entries: [decision],
      orders: [order],
      perpPositions: [],
      livePilotJournal: [],
      optionsTestnetJournal: [],
      binanceTestnetJournal: [],
    };
    const ledger = buildLedgerEntriesFromSources(bundle, "ws-test");
    const trade = ledger.find((e) => e.entryKind === "TRADE");
    assert.ok(trade);
    assert.equal(trade?.linkedDecisionId, "dec-1");
    assert.equal(trade?.linkedTradeId, order.id);
    assert.equal(trade?.environment, "PAPER");
  });

  it("builds SIGNAL to RESOLVED timeline for one trade", () => {
    const decision = sampleDecision("dec-2");
    const order = sampleOrder("dec-2");
    const entries = buildLedgerEntriesFromSources(
      {
        entries: [decision],
        orders: [order],
        perpPositions: [],
        livePilotJournal: [],
        optionsTestnetJournal: [],
      binanceTestnetJournal: [],
      },
      "ws-test",
    );
    const timelines = buildTradeTimelines(entries);
    const tl = timelines.find((t) => t.decisionId === "dec-2");
    assert.ok(tl);
    assert.ok(
      ["CLOSED", "RESOLVED", "LEARNED"].includes(tl!.currentStage) ||
        tl!.events.length >= 2,
    );
  });

  it("validates entry hashes", () => {
    const d = mapDecisionToLedger(sampleDecision("dec-3"), "ws-test");
    assert.equal(d.hash, hashLedgerPayload(d.payload));
    const health = evaluateLedgerHealth([d]);
    assert.equal(health.healthy, true);
  });

  it("flags hash mismatch as unhealthy", () => {
    const d = mapDecisionToLedger(sampleDecision("dec-4"), "ws-test");
    const bad = { ...d, hash: "bad" };
    const health = evaluateLedgerHealth([bad]);
    assert.equal(health.healthy, false);
    assert.ok(health.missingHashes > 0);
  });

  it("maps shadow paper to SHADOW environment", () => {
    const order = { ...sampleOrder("dec-5"), paperMode: "RELAXED_PAPER" as const };
    const led = mapPaperOrderToLedger(order, [], "ws-test");
    const trade = led.find((e) => e.entryKind === "TRADE");
    assert.equal(trade?.environment, "SHADOW");
  });
});
