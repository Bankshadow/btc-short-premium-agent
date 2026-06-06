import assert from "node:assert/strict";
import test from "node:test";
import { emptyMissionFlowSnapshot } from "./empty-snapshot";
import { buildMissionFlowSnapshot } from "./build-mission-flow-snapshot";
import { buildGoalProgressSnapshot } from "@/lib/goal-engine/build-goal-snapshot";
import { buildMissionSnapshotFromGoal } from "@/lib/goal-engine/build-mission-snapshot";
import type { GoalDashboardServerPayload } from "@/lib/goal-engine/build-server-context";
import { buildCoreEngineRegistry } from "@/lib/core-engine-registry";

function minimalPayload(): GoalDashboardServerPayload {
  const goal = buildGoalProgressSnapshot({
    entries: [],
    orders: [],
    risk: { testnetConfigured: true, testnetConnected: true },
  });
  const mission = buildMissionSnapshotFromGoal(goal);
  return {
    goal,
    mission,
    automation: null,
    learningPending: [],
    telegramConfigured: true,
    binance: {
      configured: true,
      testnetEnabled: true,
      connected: true,
      proxyEnabled: true,
      proxyProvider: "Fly.io (Singapore)",
      baseUrl: "https://btc-binance-testnet-proxy.fly.dev",
      upstreamBaseUrl: "https://demo-fapi.binance.com",
      autoExecuteEnabled: false,
      liveLocked: true,
      blocker: null,
      error: null,
      debugHref: "/binance-testnet",
    },
    engines: buildCoreEngineRegistry({
      market: {},
      agents: {},
      strategy: {},
      risk: {},
      ledger: { healthy: true, entryCount: 0, lastRunAt: null },
      portfolio: { dataConnected: false, lastRunAt: null },
      testnetExecution: { configured: true, connected: true, enabled: true, openPositions: 0, requiresDoubleConfirm: true, failedRecently: false },
      positionMonitor: { openPositions: 0, affectsOpenPosition: false },
      pnl: { netPnlUsd: 0, affectsGoalProgress: false },
      learning: { learnedCount: 0, pendingReview: 0, minTradesForTrust: 12 },
      notification: { anyChannelConfigured: false, recentDeliveryFailures: 0, lastDeliveryAt: null },
      reporting: { lastReportAt: null },
      projectStrategist: { pendingProposals: 0 },
    }),
  };
}

test("empty mission flow snapshot provides zero-state defaults", () => {
  const s = emptyMissionFlowSnapshot();
  assert.equal(s.currentEquity, 1000);
  assert.equal(s.progressPct, 0);
  assert.equal(s.totalTrades, 0);
  assert.equal(s.winRate, null);
  assert.equal(s.aiStatus.state, "IDLE");
  assert.equal(s.binanceTestnet.status, "DISCONNECTED");
});

test("mission flow snapshot maps connected binance and trust progress", () => {
  const flow = buildMissionFlowSnapshot(minimalPayload(), null, 0);
  assert.equal(flow.binanceTestnet.status, "CONNECTED");
  assert.equal(flow.binanceTestnet.reason, "connected");
  assert.equal(flow.trust.completedTrades, 0);
  assert.equal(flow.trust.minRequired, 12);
  assert.ok(flow.nextRecommendation.length > 0);
});

test("mission flow snapshot detects HTTP 451 blocked status", () => {
  const payload = minimalPayload();
  payload.binance.connected = false;
  payload.binance.error = "Binance HTTP 451: Service unavailable from a restricted location";
  const flow = buildMissionFlowSnapshot(payload, null, 0);
  assert.equal(flow.binanceTestnet.status, "BLOCKED");
  assert.ok(flow.binanceTestnet.reason.includes("451"));
});

test("mission flow snapshot includes automation defaults", () => {
  const flow = buildMissionFlowSnapshot(minimalPayload(), null, 0);
  assert.equal(flow.automation.enabled, true);
  assert.equal(flow.automation.intervalMinutes, 15);
  assert.equal(flow.learningPending.length, 0);
});

test("mission flow snapshot surfaces pending testnet preview", () => {
  const payload = minimalPayload();
  const pending = {
    previewId: "bn-prev-test",
    symbol: "BTCUSDT",
    side: "SELL",
    notionalUsd: 10,
    estimatedQty: "0.001",
    markPrice: 70000,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    blocked: false,
    blockReasons: [],
    reason: "AI desk signal",
    decisionLogId: "dec-1",
  };
  const flow = buildMissionFlowSnapshot(payload, "dec-1", 0, pending);
  assert.equal(flow.pendingTestnetPreview?.previewId, "bn-prev-test");
  assert.equal(flow.aiStatus.humanActionRequired, true);
  assert.ok(flow.nextRecommendation.includes("Review testnet order"));
});
