import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { buildDeskBackboneRecord, mapDecision, mapTrade } from "./build-record";
import { evaluateBackboneHealth, isBackboneHealthyForLive } from "./health";
import { clearMemoryBackbone, writeMemoryBackbone } from "./adapters/in-memory";
import { loadDeskBackbone } from "./read-desk-state";

const store: Record<string, string> = {};

function installMocks() {
  (globalThis as { window?: typeof globalThis }).window = globalThis;
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: () => null,
    length: 0,
  } as Storage;
}

describe("data backbone MVP 43", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    clearMemoryBackbone();
    installMocks();
  });

  it("builds consistent portfolio and learning sample size", () => {
    const entries: DecisionLogEntry[] = [
      {
        id: "e1",
        runId: "r1",
        timestamp: new Date().toISOString(),
        btcPrice: 96000,
        marketRegime: "Bearish",
        agentOutputs: [],
        finalVerdict: "TRADE",
        riskVeto: false,
        topReasons: [],
        actionPlan: "",
        outcomeStatus: "RESOLVED",
        paperPnl: 1.2,
        reflection: null,
      },
    ];
    const orders: PaperOrder[] = [
      {
        id: "o1",
        decisionLogId: "e1",
        committeeVerdict: "TRADE",
        instrument: "sell_call",
        symbol: "BTC",
        side: "short",
        entryBtcPrice: 96000,
        entryOptionMark: 400,
        strike: 98000,
        sizePct: 1,
        notionalUsd: 100,
        status: "CLOSED",
        openedAt: new Date().toISOString(),
        closedAt: new Date().toISOString(),
        exitBtcPrice: 95000,
        realizedPnlPct: 1.2,
        unrealizedPnlPct: null,
        lastMarkAt: null,
        lastMarkBtcPrice: null,
        openedBy: "committee_auto",
        notes: "",
        paperMode: "STRICT_PAPER",
      },
    ];

    const record = buildDeskBackboneRecord({
      entries,
      orders,
      riskProfile: "balanced",
    });

    assert.equal(record.portfolio.sampleSize, record.learning.strategySampleSize);
    assert.equal(record.decisions.length, 1);
    assert.equal(record.trades.length, 1);
    assert.equal(record.trades[0].book, "PAPER_STRICT");
  });

  it("labels demo and shadow trades separately", () => {
    const entry: DecisionLogEntry = {
      id: "e-demo",
      isDemoData: true,
      timestamp: new Date().toISOString(),
      btcPrice: 96000,
      marketRegime: "Demo",
      agentOutputs: [],
      finalVerdict: "WAIT",
      riskVeto: false,
      topReasons: [],
      actionPlan: "",
      outcomeStatus: "PENDING",
      paperPnl: null,
      reflection: null,
    };
    const shadow: PaperOrder = {
      id: "o-shadow",
      decisionLogId: "e-shadow",
      committeeVerdict: "WAIT",
      instrument: "no_trade",
      symbol: "BTC",
      side: "none",
      entryBtcPrice: 96000,
      entryOptionMark: null,
      strike: null,
      sizePct: 1,
      notionalUsd: 100,
      status: "OPEN",
      openedAt: new Date().toISOString(),
      closedAt: null,
      exitBtcPrice: null,
      realizedPnlPct: null,
      unrealizedPnlPct: 0,
      lastMarkAt: null,
      lastMarkBtcPrice: null,
      openedBy: "relaxed_auto",
      notes: "",
      paperMode: "RELAXED_PAPER",
    };

    assert.equal(mapDecision(entry, []).bookLabel, "DEMO");
    assert.equal(mapTrade(shadow, []).book, "PAPER_SHADOW");
  });

  it("blocks live mode when backbone unhealthy", () => {
    const health = evaluateBackboneHealth({
      lastWriteAt: null,
      syncStatus: "OFF",
      source: "localStorage",
      portfolio: {
        generatedAt: new Date().toISOString(),
        paperPnlPct: 0,
        openPaperTrades: 0,
        closedPaperTrades: 0,
        shadowTrades: 0,
        exposureUsd: 0,
        drawdownPct: 0,
        resolvedLogCount: 0,
        productionResolvedCount: 0,
        winRatePct: 0,
        sampleSize: 0,
      },
      learning: {
        generatedAt: new Date().toISOString(),
        decisionLogsCount: 0,
        resolvedOutcomesCount: 0,
        paperTradesCount: 0,
        shadowTradesCount: 0,
        strategySampleSize: 0,
        minRequiredSampleSize: 12,
        agentScoreboardReady: false,
        validationReady: false,
        capitalScalingReady: false,
        label: "Empty",
        detail: "",
      },
      risk: {
        generatedAt: new Date().toISOString(),
        deskStatus: "BLOCKED",
        blockers: ["No data"],
        liveReadinessBlocked: true,
        backboneHealthy: false,
      },
      writeOk: false,
      writeError: "Write failed",
    });
    assert.equal(isBackboneHealthyForLive(health), false);
  });

  it("reads from memory when local cache seeded", () => {
    const record = buildDeskBackboneRecord({
      entries: [],
      orders: [],
      riskProfile: "balanced",
    });
    writeMemoryBackbone(record);
    const loaded = loadDeskBackbone();
    assert.equal(loaded.clientId, record.clientId);
  });
});
