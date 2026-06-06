import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { applyTradingOsRuntime } from "@/lib/trading-os/trading-os-runtime";
import { resolveModeEffects } from "@/lib/trading-os/environment-modes";
import { getMockDashboardFallback } from "@/lib/mock/dashboard-data";
import {
  appendDecisionLogFromAnalysis,
  loadDecisionLog,
  persistDecisionLog,
} from "@/lib/journal/decision-log";
import {
  loadPaperOrders,
  persistPaperOrders,
  savePaperSettings,
} from "@/lib/paper/paper-orders";
import { DEFAULT_PAPER_SETTINGS } from "@/lib/paper/paper-order-types";
import { DEFAULT_GOVERNANCE_STATE } from "@/lib/governance/governance-state";
import { GOVERNANCE_STORAGE_KEY } from "@/lib/governance/governance-state";
import { evaluatePaperAutopilotCreate } from "./evaluate-create";
import {
  createLifecycleForOrder,
  loadPaperLifecycleRecords,
  persistPaperLifecycleRecords,
} from "./lifecycle-store";
import {
  getPendingResolutionQueue,
  resolveLifecycleNow,
} from "./resolve-queue";
import { runPaperAutopilot } from "./run-engine";
import { savePaperAutopilotSettings } from "./settings-store";
import { DEFAULT_PAPER_AUTOPILOT_SETTINGS } from "./config";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { closePaperOrderAndSyncLog } from "@/lib/paper/paper-execution";
import { transitionLifecycle } from "./lifecycle-store";

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

function sampleOrder(overrides: Partial<PaperOrder> = {}): PaperOrder {
  return {
    id: "po-test-1",
    decisionLogId: "log-test-1",
    committeeVerdict: "TRADE",
    instrument: "sell_call",
    symbol: "BTC",
    side: "short",
    entryBtcPrice: 96_000,
    entryOptionMark: 400,
    strike: 98_000,
    sizePct: 1,
    notionalUsd: 100,
    status: "OPEN",
    openedAt: new Date().toISOString(),
    closedAt: null,
    exitBtcPrice: null,
    realizedPnlPct: null,
    unrealizedPnlPct: 0,
    lastMarkAt: new Date().toISOString(),
    lastMarkBtcPrice: 96_000,
    openedBy: "committee_auto",
    notes: "test",
    paperMode: "STRICT_PAPER",
    ...overrides,
  };
}

describe("paper autopilot MVP 44", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    installStorageMock();
    applyTradingOsRuntime(resolveModeEffects("DEMO"));
    persistDecisionLog([]);
    persistPaperOrders([]);
    persistPaperLifecycleRecords([]);
    savePaperSettings({ ...DEFAULT_PAPER_SETTINGS });
    savePaperAutopilotSettings({ ...DEFAULT_PAPER_AUTOPILOT_SETTINGS });
    localStorage.setItem(
      GOVERNANCE_STORAGE_KEY,
      JSON.stringify(DEFAULT_GOVERNANCE_STATE),
    );
  });

  it("evaluates TRADE → CREATE_PAPER in PAPER_ON_TRADE mode", () => {
    const data = getMockDashboardFallback();
    data.step5_verdict.recommendation = "trade";
    data.step6_actionPlan.action = "sell_call";
    if (data.tradingDesk) {
      data.tradingDesk.committee.finalVerdict = "TRADE";
      data.tradingDesk.committee.riskVeto = false;
      data.tradingDesk.riskManager.veto = false;
    }
    if (data.preMortem) {
      data.preMortem.preMortemVerdict = "PASS";
    }
    const eval_ = evaluatePaperAutopilotCreate({
      mode: "PAPER_ON_TRADE",
      data,
      settings: DEFAULT_PAPER_AUTOPILOT_SETTINGS,
      governance: DEFAULT_GOVERNANCE_STATE,
      orders: [],
    });
    assert.equal(eval_.action, "CREATE_PAPER", eval_.reason);
    assert.equal(eval_.blocked, false);
  });

  it("blocks paper on pre-mortem BLOCK", () => {
    const data = getMockDashboardFallback();
    data.preMortem = {
      ...(data.preMortem ?? {
        preMortemVerdict: "PASS",
        topFailureReason: "",
        invalidationTriggers: [],
        confidenceAdjustment: 0,
      }),
      preMortemVerdict: "BLOCK",
    };
    const eval_ = evaluatePaperAutopilotCreate({
      mode: "PAPER_STRICT",
      data,
      settings: DEFAULT_PAPER_AUTOPILOT_SETTINGS,
      governance: DEFAULT_GOVERNANCE_STATE,
      orders: [],
    });
    assert.equal(eval_.action, "NONE");
    assert.equal(eval_.blockReason, "PRE_MORTEM_BLOCK");
  });

  it("creates lifecycle record for paper order", () => {
    const order = sampleOrder();
    persistPaperOrders([order]);
    const record = createLifecycleForOrder(order);
    assert.equal(record.status, "OPEN");
    assert.equal(record.book, "PAPER_STRICT");
    assert.ok(loadPaperLifecycleRecords().length >= 1);
  });

  it("runs monitor and recommends close on stop loss", () => {
    savePaperAutopilotSettings({
      ...DEFAULT_PAPER_AUTOPILOT_SETTINGS,
      mode: "PAPER_ON_TRADE",
      stopLossPct: -0.5,
    });
    const order = sampleOrder({ unrealizedPnlPct: -1 });
    persistPaperOrders([order]);
    createLifecycleForOrder(order);
    const { entry } = appendDecisionLogFromAnalysis(getMockDashboardFallback());
    const result = runPaperAutopilot({
      data: getMockDashboardFallback(),
      decisionLogId: entry.id,
      btcPrice: 100_000,
      settings: { mode: "PAPER_ON_TRADE", autoCloseOnRecommendation: false },
    });
    assert.ok(result.monitored >= 1);
    const lifecycle = loadPaperLifecycleRecords().find((r) => r.tradeId === order.id);
    assert.ok(lifecycle);
    assert.ok(
      lifecycle.status === "CLOSE_RECOMMENDED" ||
        result.signals.some((s) => s.recommendClose),
    );
  });

  it("queues manual resolution after close without auto-resolve", () => {
    const data = getMockDashboardFallback();
    const { entry } = appendDecisionLogFromAnalysis(data);
    const order = sampleOrder({ decisionLogId: entry.id });
    persistPaperOrders([order]);
    const lifecycle = createLifecycleForOrder(order);

    closePaperOrderAndSyncLog(order.id, {
      exitBtcPrice: 97_000,
      notes: "Test close — resolution deferred.",
      skipResolve: true,
    });
    transitionLifecycle(lifecycle.lifecycleId, "CLOSED", "Closed for resolution test.", {
      realizedPnlPct: 1.2,
      closedAt: new Date().toISOString(),
    });

    const pending = getPendingResolutionQueue();
    assert.equal(pending.length, 1);
    assert.equal(loadDecisionLog()[0]?.outcomeStatus, "PENDING");

    const resolved = resolveLifecycleNow(pending[0].lifecycleId, {
      btcPriceAfter: 97_000,
      tradeWouldWin: true,
      outcomeLabel: "WIN",
      manualPnlPct: 1.2,
      notes: "Manual resolve test",
    });
    assert.ok(resolved);
    assert.equal(resolved?.status, "RESOLVED");
    assert.equal(loadDecisionLog()[0]?.outcomeStatus, "RESOLVED");
    assert.equal(resolved?.rMultiple != null, true);
  });

  it("never enables live execution paths", () => {
    const result = runPaperAutopilot({
      btcPrice: 96_000,
      settings: { mode: "PAPER_RELAXED" },
    });
    assert.ok(result.safetyNotice.includes("never calls live"));
    assert.equal(result.skipped, false);
  });
});
