import assert from "node:assert/strict";
import test from "node:test";
import { buildGoalProgressSnapshot } from "./build-goal-snapshot";
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
