import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  appendDecisionLogFromAnalysis,
  deriveAnalyzeRunId,
  loadDecisionLog,
  persistDecisionLog,
  resolveDecisionOutcome,
} from "@/lib/journal/decision-log";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import {
  countProductionResolved,
  filterProductionEntries,
  filterProductionOrders,
} from "@/lib/journal/production-filter";
import { getTradeLifecycleForEntry } from "@/lib/journal/trade-lifecycle";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { getMockDashboardFallback } from "@/lib/mock/dashboard-data";

const store: Record<string, string> = {};

function installStorageMock() {
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

describe("desk workflow MVP 42", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    installStorageMock();
    persistDecisionLog([]);
  });

  it("dedupes decision log by runId", () => {
    const data = getMockDashboardFallback();
    const runId = deriveAnalyzeRunId(data);
    const first = appendDecisionLogFromAnalysis(data, { runId });
    assert.equal(first.status, "created");
    assert.equal(loadDecisionLog().length, 1);

    const second = appendDecisionLogFromAnalysis(data, { runId });
    assert.equal(second.status, "updated");
    assert.equal(loadDecisionLog().length, 1);
    assert.equal(second.entry.id, first.entry.id);
  });

  it("excludes demo data from production metrics", () => {
    const entries: DecisionLogEntry[] = [
      {
        id: "real-1",
        timestamp: new Date().toISOString(),
        btcPrice: 96000,
        marketRegime: "Test",
        agentOutputs: [],
        finalVerdict: "TRADE",
        riskVeto: false,
        topReasons: [],
        actionPlan: "",
        outcomeStatus: "RESOLVED",
        paperPnl: 1,
        reflection: null,
      },
      {
        id: "demo-1",
        isDemoData: true,
        timestamp: new Date().toISOString(),
        btcPrice: 96000,
        marketRegime: "Demo",
        agentOutputs: [],
        finalVerdict: "TRADE",
        riskVeto: false,
        topReasons: [],
        actionPlan: "",
        outcomeStatus: "RESOLVED",
        paperPnl: 2,
        reflection: null,
      },
    ];
    assert.equal(filterProductionEntries(entries).length, 1);
    assert.equal(countProductionResolved(entries), 1);
  });

  it("resolves outcome with manual PnL and label", () => {
    const data = getMockDashboardFallback();
    const { entry } = appendDecisionLogFromAnalysis(data);
    const result = resolveDecisionOutcome(entry.id, {
      btcPriceAfter: 97000,
      tradeWouldWin: true,
      notes: "Test resolve",
      outcomeLabel: "WIN",
      manualPnlPct: 1.5,
    });
    assert.ok(result);
    assert.equal(result.entry.paperPnl, 1.5);
    assert.equal(result.entry.resolution?.outcomeLabel, "WIN");
    assert.equal(result.entry.outcomeStatus, "RESOLVED");
  });

  it("reports trade lifecycle linked to decision log", () => {
    const orders: PaperOrder[] = [
      {
        id: "po-1",
        decisionLogId: "log-1",
        committeeVerdict: "TRADE",
        instrument: "sell_call",
        symbol: "BTC",
        side: "short",
        entryBtcPrice: 90000,
        entryOptionMark: 400,
        strike: 92000,
        sizePct: 1,
        notionalUsd: 100,
        status: "OPEN",
        openedAt: new Date().toISOString(),
        closedAt: null,
        exitBtcPrice: null,
        realizedPnlPct: null,
        unrealizedPnlPct: 0.5,
        lastMarkAt: null,
        lastMarkBtcPrice: null,
        openedBy: "committee_auto",
        notes: "",
        paperMode: "STRICT_PAPER",
      },
    ];
    const lc = getTradeLifecycleForEntry("log-1", orders);
    assert.equal(lc.status, "PAPER_OPEN");
    assert.equal(lc.label, "Paper open");
  });

  it("filters demo paper orders from production book", () => {
    const orders: PaperOrder[] = [
      {
        id: "o1",
        decisionLogId: "l1",
        committeeVerdict: "TRADE",
        instrument: "sell_call",
        symbol: "BTC",
        side: "short",
        entryBtcPrice: 90000,
        entryOptionMark: null,
        strike: null,
        sizePct: 1,
        notionalUsd: 100,
        status: "CLOSED",
        openedAt: new Date().toISOString(),
        closedAt: new Date().toISOString(),
        exitBtcPrice: 91000,
        realizedPnlPct: 1,
        unrealizedPnlPct: null,
        lastMarkAt: null,
        lastMarkBtcPrice: null,
        openedBy: "committee_auto",
        notes: "",
        isDemoData: true,
      },
    ];
    assert.equal(filterProductionOrders(orders).length, 0);
  });
});
