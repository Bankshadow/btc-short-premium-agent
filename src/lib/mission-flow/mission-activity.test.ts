import assert from "node:assert/strict";
import test from "node:test";
import { buildMissionActivityFromRuns } from "./build-mission-activity";
import { resolvePrimaryStrategyHealth } from "./resolve-primary-strategy-health";
import type { AutomationRun } from "@/lib/automation-control-plane/types";

function sampleRun(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    runId: "run-test",
    workspaceId: "server-default",
    status: "SUCCESS",
    trigger: "cron",
    idempotencyKey: "key",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    jobs: [
      {
        jobId: "j1",
        workspaceId: "server-default",
        jobType: "DESK_ANALYZE",
        status: "SUCCESS",
        idempotencyKey: "k1",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 100,
        resultSummary: "Analyze created · SKIP · autopilot BLOCKED",
        error: null,
        linkedRunId: "run-test",
      },
    ],
    errors: [],
    nextRunAt: null,
    linkedRunId: null,
    safetyNotice: "test",
    cannotApproveLiveTrades: true,
    cannotIncreaseRisk: true,
    cannotDisableKillSwitch: true,
    analyze: {
      step5_verdict: { recommendation: "SKIP" },
    } as AutomationRun["analyze"],
    autopilotResult: null,
    ...overrides,
  };
}

test("buildMissionActivityFromRuns maps verdict and summary", () => {
  const items = buildMissionActivityFromRuns([sampleRun()]);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.verdict, "SKIP");
  assert.ok(items[0]?.summary.includes("SKIP"));
});

test("resolvePrimaryStrategyHealth blocks paused strategies", () => {
  const blocked = resolvePrimaryStrategyHealth({
    generatedAt: new Date().toISOString(),
    rows: [
      {
        strategyId: "options_short_premium",
        strategyLabel: "BTC Short Premium",
        sampleSize: 3,
        winRate: 40,
        averageR: 0.1,
        totalPnl: 10,
        maxDrawdown: 5,
        averageDurationMs: 1000,
        falseTradeCount: 0,
        falseSkipCount: 0,
        bestRegime: "RANGE",
        worstRegime: "TREND",
        agentAgreementQuality: { scorePct: 50, label: "MEDIUM", comparedEntries: 2 },
        currentStatus: "PAUSED",
        recommendation: "pause strategy",
        executionReliabilityPct: 90,
        executionWarning: false,
        environmentMetrics: {} as never,
      },
    ],
    totals: {
      strategies: 1,
      watchlist: 0,
      activePaper: 0,
      activeTestnet: 0,
      reviewRequired: 0,
      paused: 1,
      candidateForLive: 0,
    },
    environmentTotals: {} as never,
  });
  assert.equal(blocked?.tradeAllowed, false);
  assert.ok(blocked?.blockReason?.includes("paused"));
});
