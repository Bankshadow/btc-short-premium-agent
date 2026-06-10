import type { GoalDashboardServerPayload } from "@/lib/goal-engine/build-server-context";
import { buildGoalProgressSnapshot } from "@/lib/goal-engine/build-goal-snapshot";
import { buildMissionSnapshotFromGoal } from "@/lib/goal-engine/build-mission-snapshot";
import { buildCoreEngineRegistry } from "@/lib/core-engine-registry";
import { buildStrategyHealthSummary } from "@/lib/strategy-health";
import type { TestnetMonitorSnapshot } from "@/lib/testnet-monitor/types";

export function minimalPayloadWithTestnet(
  testnetSnapshot: Partial<TestnetMonitorSnapshot>,
): GoalDashboardServerPayload {
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
    learningPending:
      testnetSnapshot.learningRecords?.filter((r) => r.status === "PENDING_REVIEW") ?? [],
    learningRecords: testnetSnapshot.learningRecords ?? [],
    strategyHealth: buildStrategyHealthSummary({ entries: [], orders: [] }),
    telegramConfigured: true,
    binance: {
      configured: true,
      testnetEnabled: true,
      connected: true,
      proxyEnabled: false,
      proxyProvider: "",
      baseUrl: "https://demo-fapi.binance.com",
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
      testnetExecution: {
        configured: true,
        connected: true,
        enabled: true,
        openPositions: 0,
        requiresDoubleConfirm: true,
        failedRecently: false,
      },
      positionMonitor: { openPositions: 0, affectsOpenPosition: false },
      pnl: { netPnlUsd: testnetSnapshot.summary?.netPnl ?? 0, affectsGoalProgress: true },
      learning: { learnedCount: 0, pendingReview: 0, minTradesForTrust: 12 },
      notification: { anyChannelConfigured: false, recentDeliveryFailures: 0, lastDeliveryAt: null },
      reporting: { lastReportAt: null },
      projectStrategist: { pendingProposals: 0 },
    }),
    testnetSnapshot: testnetSnapshot as TestnetMonitorSnapshot,
  };
}
