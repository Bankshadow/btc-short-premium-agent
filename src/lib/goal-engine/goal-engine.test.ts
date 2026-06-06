import assert from "node:assert/strict";
import test from "node:test";
import { buildGoalProgressSnapshot } from "./build-goal-snapshot";
import {
  buildMissionSnapshot,
  emptyMissionSnapshot,
  resolveProxyProviderLabel,
} from "./build-mission-snapshot";
import type { PaperOrder } from "@/lib/paper/paper-order-types";

function order(id: string, patch?: Partial<PaperOrder>): PaperOrder {
  return {
    id,
    decisionLogId: `d-${id}`,
    committeeVerdict: "TRADE",
    instrument: "sell_call",
    symbol: "BTCUSDT",
    side: "short",
    entryBtcPrice: 100_000,
    entryOptionMark: null,
    strike: null,
    sizePct: 1,
    notionalUsd: 1_000,
    status: "CLOSED",
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: "2026-01-01T01:00:00.000Z",
    exitBtcPrice: 99_000,
    realizedPnlPct: 10,
    unrealizedPnlPct: null,
    lastMarkAt: null,
    lastMarkBtcPrice: null,
    openedBy: "committee_auto",
    notes: "",
    ...patch,
  };
}

test("mission tracks $1,000 to $10,000 progress", () => {
  const snapshot = buildGoalProgressSnapshot({
    entries: [],
    orders: [
      order("o1", { realizedPnlPct: 10 }), // +$100
      order("o2", { realizedPnlPct: -5 }), // -$50
    ],
  });

  assert.equal(snapshot.mission.startCapital, 1_000);
  assert.equal(snapshot.mission.targetCapital, 10_000);
  assert.equal(snapshot.mission.netPnl, 50);
  assert.equal(snapshot.mission.currentEquity, 1_050);
  assert.ok(snapshot.mission.progressPct > 0);
  assert.equal(snapshot.mission.remainingToTarget, 8_950);
  assert.equal(snapshot.tradeStats.totalTrades, 2);
  assert.equal(snapshot.tradeStats.winTrades, 1);
  assert.equal(snapshot.tradeStats.lossTrades, 1);
  assert.equal(snapshot.tradeStats.winRate, 50);
});

test("LIVE trades never fold into the combined mission scope", () => {
  const snapshot = buildGoalProgressSnapshot({
    entries: [],
    orders: [order("o1", { realizedPnlPct: 10 })],
    liveTrades: [
      {
        liveTradeId: "l1",
        sourceSignalId: null,
        decisionLogId: "d1",
        previewId: "p1",
        confirmTokenId: "t",
        exchangeOrderId: "x1",
        status: "CLOSED",
        symbol: "BTCUSDT",
        side: "Sell",
        entry: null,
        exit: null,
        realizedPnl: 999,
        fees: 0,
        slippage: 0,
        operatorApproval: true,
        operatorApprovalNote: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        executedAt: "2026-01-01T00:01:00.000Z",
        closedAt: "2026-01-01T01:00:00.000Z",
        error: null,
        pilotMode: "LIVE_TESTNET",
      },
    ],
  });

  // Combined mission must exclude the +999 live trade.
  assert.equal(snapshot.mission.netPnl, 100);
  assert.equal(snapshot.live.equity.netPnl, 999);
  assert.equal(snapshot.byEnvironment.LIVE.tradeStats.totalTrades, 1);
});

test("demo data is excluded from metrics", () => {
  const snapshot = buildGoalProgressSnapshot({
    entries: [],
    orders: [
      order("o1", { realizedPnlPct: 10 }),
      order("demo", { realizedPnlPct: 500, isDemoData: true }),
    ],
  });
  assert.equal(snapshot.tradeStats.totalTrades, 1);
  assert.equal(snapshot.mission.netPnl, 100);
});

test("AI status reflects waiting when paused", () => {
  const snapshot = buildGoalProgressSnapshot({
    entries: [],
    orders: [],
    ai: { automationEnabled: true, automationPaused: true },
  });
  assert.equal(snapshot.aiActivity.status, "WAITING");
  assert.equal(snapshot.aiActivity.humanActionRequired, true);
});

test("AI status reflects blocked when risk blocker present", () => {
  const snapshot = buildGoalProgressSnapshot({
    entries: [],
    orders: [],
    risk: { blocker: "Daily loss limit reached." },
  });
  assert.equal(snapshot.aiActivity.status, "BLOCKED");
  assert.equal(snapshot.userActionRequired.required, true);
});

test("zero state shows friendly message when no data", () => {
  const snapshot = buildGoalProgressSnapshot({
    entries: [],
    orders: [],
    risk: { testnetConfigured: false, testnetConnected: false },
  });
  assert.equal(snapshot.dataConnected, false);
  assert.ok(snapshot.zeroStateMessage?.includes("Trade data is not connected yet"));
  assert.equal(snapshot.primaryCta.label, "Configure Binance Testnet");
});

test("primary CTA suggests first cycle when testnet connected but no trades", () => {
  const snapshot = buildGoalProgressSnapshot({
    entries: [],
    orders: [],
    risk: { testnetConfigured: true, testnetConnected: true },
  });
  assert.equal(snapshot.primaryCta.label, "Run First AI Cycle");
});

test("environmentBreakdown mirrors byEnvironment", () => {
  const snapshot = buildGoalProgressSnapshot({
    entries: [],
    orders: [order("o1", { realizedPnlPct: 5 })],
  });
  assert.equal(snapshot.environmentBreakdown.PAPER.tradeStats.totalTrades, 1);
});

test("mission snapshot exposes flat KPI fields", () => {
  const mission = buildMissionSnapshot({
    entries: [],
    orders: [
      order("o1", { realizedPnlPct: 10 }),
      order("o2", { realizedPnlPct: -5 }),
    ],
    risk: { testnetConfigured: true, testnetConnected: true },
    learning: { pendingReview: 2, learnedCount: 3 },
  });

  assert.equal(mission.startCapital, 1_000);
  assert.equal(mission.targetCapital, 10_000);
  assert.equal(mission.totalTrades, 2);
  assert.equal(mission.winTrades, 1);
  assert.equal(mission.lossTrades, 1);
  assert.equal(mission.netPnl, 50);
  assert.equal(mission.pendingLearningReview, 2);
  assert.equal(mission.learnedTrades, 3);
  assert.ok(mission.nextAction.length > 0);
});

test("empty mission snapshot shows zero-state defaults", () => {
  const mission = emptyMissionSnapshot();
  assert.equal(mission.currentEquity, 1_000);
  assert.equal(mission.progressPct, 0);
  assert.equal(mission.totalTrades, 0);
  assert.equal(mission.winTrades, 0);
  assert.equal(mission.lossTrades, 0);
  assert.ok(mission.nextAction.includes("AI cycle"));
});

test("proxy provider label resolves fly and cloudflare", () => {
  assert.equal(
    resolveProxyProviderLabel({
      proxyEnabled: true,
      baseUrl: "https://btc-binance-testnet-proxy.fly.dev",
    } as never),
    "Fly.io (Singapore)",
  );
  assert.equal(
    resolveProxyProviderLabel({
      proxyEnabled: true,
      baseUrl: "https://proxy.btc-desk.workers.dev",
    } as never),
    "Cloudflare Worker",
  );
});

test("desk run marks data connected without trades", () => {
  const snapshot = buildGoalProgressSnapshot({
    entries: [{ id: "e1" } as never],
    orders: [],
    lastDeskRun: {
      runId: "run-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:01:00.000Z",
      status: "COMPLETED",
      mode: "ANALYSIS_ONLY",
      deskStatus: "CAUTION",
      finalVerdict: "SKIP",
      confidence: 50,
      briefing: "test",
      source: "hybrid",
      writeOk: true,
      errors: [],
    },
    risk: { testnetConfigured: true, testnetConnected: true },
  });
  assert.equal(snapshot.dataConnected, true);
});
