import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDailyReviewQuestions,
  buildDailySelfReviewRecord,
  computeDailyScore,
  filterEntriesForUtcDay,
  utcDateKey,
} from "./build-daily-self-review";
import type { ParallelReviewContext } from "@/lib/parallel-task-runner/build-review-context";
import type { MissionControllerResult } from "@/lib/mission-controller/types";
import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";
import { MISSION_CONTROLLER_SAFETY_NOTICE } from "@/lib/mission-controller/types";

function baseMission(overrides: Partial<MissionControllerResult> = {}): MissionControllerResult {
  return {
    generatedAt: new Date().toISOString(),
    mode: "NORMAL",
    modeReason: "Test",
    recommendedRiskLevel: "BALANCED",
    riskLevelRequiresApproval: false,
    tradeFrequency: "NORMAL",
    allowedStrategyTypes: ["futures_long"],
    nextAction: "Continue",
    humanApprovalNeeded: false,
    humanApprovalReason: null,
    aiConfidence: 0.7,
    inputs: {
      currentEquity: 1000,
      targetEquity: 10000,
      startEquity: 1000,
      dailyPnlPct: 1,
      weeklyPnlPct: 2,
      drawdownUsd: 0,
      drawdownPct: 0,
      winRate: 55,
      losingStreak: 0,
      openExposureUsd: 0,
      aiConfidence: 0.7,
      riskStatus: "SAFE",
      dailyLossLimitHit: false,
      completedTrades: 5,
      trustReady: false,
      automationPaused: false,
      committeePause: false,
      loopGuardActive: false,
      pendingTestnetPreview: false,
      humanActionRequired: false,
    },
    safetyNotice: MISSION_CONTROLLER_SAFETY_NOTICE,
    liveLocked: true,
    canAutoReduceRisk: true,
    cannotAutoIncreaseLiveRisk: true,
    ...overrides,
  };
}

function baseSnapshot(): MissionFlowSnapshot {
  return {
    startCapital: 1000,
    targetCapital: 10000,
    currentEquity: 1050,
    progressPct: 5,
    remainingToTarget: 8950,
    netPnl: 50,
    realizedPnl: 50,
    unrealizedPnl: 0,
    maxDrawdown: 0,
    closedTrades: 5,
    openTrades: 0,
    wins: 3,
    losses: 2,
    breakeven: 0,
    winRate: 60,
    learnedTrades: 2,
    pendingLearningReview: 0,
    trust: { completedTrades: 5, minRequired: 20, ready: false },
    nextRecommendation: "Keep gathering trust sample.",
    lastUpdatedAt: new Date().toISOString(),
    lastVerdict: "HOLD",
    aiStatus: { state: "IDLE", lastAction: "Analyze" },
    automation: {
      enabled: true,
      paused: false,
      intervalMinutes: 15,
      lastRunAt: null,
      nextRunAt: null,
      lastRunStatus: null,
      lastTrigger: null,
      autoExecuteEnabled: false,
      autoLearnEnabled: true,
    },
    notifications: {
      telegramConfigured: false,
      notifyOnTrade: true,
      notifyOnBlocker: true,
      lastAlertAt: null,
    },
    binanceTestnet: { status: "DISCONNECTED" },
    risk: { status: "SAFE", blocker: null },
    strategyHealth: null,
    pendingTestnetPreview: null,
    positions: [],
    recentActivity: [],
    learningInsights: {
      learnedCount: 2,
      winCount: 1,
      lossCount: 1,
      avgR: 0.5,
      recent: [],
    },
    selfLearning: { serverEvaluated: 0, lastTopAgent: null },
    humanActionRequired: false,
    nextAction: "Continue",
  } as MissionFlowSnapshot;
}

function baseCtx(): ParallelReviewContext {
  return {
    workspaceId: "server-default",
    entries: [],
    orders: [],
    riskProfile: "balanced",
    strategistContext: null,
    strategistStatus: null,
    strategyHealth: {
      generatedAt: new Date().toISOString(),
      totals: {
        strategies: 1,
        watchlist: 0,
        activePaper: 0,
        activeTestnet: 1,
        reviewRequired: 0,
        paused: 0,
        candidateForLive: 0,
      },
      rows: [],
      environmentTotals: {} as ParallelReviewContext["strategyHealth"]["environmentTotals"],
    },
    riskReport: {
      riskStatus: "SAFE",
      blockNewTrades: false,
      triggeredLimits: [],
      metrics: { dailyPnlPct: 1, weeklyPnlPct: 2 },
    } as ParallelReviewContext["riskReport"],
    loopGuard: null,
    executionQuality: {
      liveQualityGate: { status: "PASS" },
      rejectionRatePct: 0,
      failedOrderCount: 0,
      duplicateSubmissionCount: 0,
      averageLatencyMs: 100,
      exchangeErrors: [],
    } as ParallelReviewContext["executionQuality"],
    secondBrain: null,
    pendingLearning: 0,
    pendingOperatorActions: 0,
  };
}

describe("Daily AI self-review (MVP 82)", () => {
  it("formats UTC date keys", () => {
    assert.equal(utcDateKey("2026-06-06T23:59:00.000Z"), "2026-06-06");
  });

  it("scores strong days higher than weak days", () => {
    const strong = computeDailyScore({
      mission: baseMission(),
      analyzeCyclesToday: 6,
      winsToday: 2,
      lossesToday: 0,
      dailyPnlPct: 2,
      executionGate: "PASS",
      riskBlocked: false,
      duplicateSubmissions: 0,
      missedHoldSignals: 0,
    });
    const weak = computeDailyScore({
      mission: baseMission({ mode: "PAUSED" }),
      analyzeCyclesToday: 20,
      winsToday: 0,
      lossesToday: 3,
      dailyPnlPct: -4,
      executionGate: "FAIL",
      riskBlocked: true,
      duplicateSubmissions: 2,
      missedHoldSignals: 4,
    });
    assert.ok(strong > weak);
    assert.ok(strong >= 70);
    assert.ok(weak <= 55);
  });

  it("flags overtrading in defensive mode", () => {
    const questions = buildDailyReviewQuestions({
      mission: baseMission({ mode: "DEFENSIVE" }),
      snapshot: baseSnapshot(),
      analyzeCyclesToday: 16,
      tradesToday: [
        {
          id: "t1",
          date: "2026-06-06",
          environment: "testnet",
          symbol: "BTCUSDT",
          side: "LONG",
          entry: 1,
          exit: 2,
          pnlUsd: -5,
          result: "LOSS",
          source: "autopilot",
          reason: "test",
          decisionLogId: null,
        },
        {
          id: "t2",
          date: "2026-06-06",
          environment: "testnet",
          symbol: "BTCUSDT",
          side: "SHORT",
          entry: 1,
          exit: 2,
          pnlUsd: -3,
          result: "LOSS",
          source: "autopilot",
          reason: "test2",
          decisionLogId: null,
        },
      ],
      winsToday: 0,
      lossesToday: 2,
      ctx: baseCtx(),
      missedHoldSignals: 0,
    });
    assert.equal(questions.overtraded.verdict, "yes");
  });

  it("builds a complete review record", () => {
    const today = utcDateKey();
    const record = buildDailySelfReviewRecord({
      trigger: "manual",
      mission: baseMission(),
      snapshot: baseSnapshot(),
      ctx: baseCtx(),
      entries: [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          btcPrice: 65000,
          marketRegime: "RANGE",
          agentOutputs: [],
          finalVerdict: "WAIT",
          riskVeto: false,
          topReasons: ["Wait for setup"],
          actionPlan: "Hold",
          outcomeStatus: "PENDING",
          paperPnl: null,
          reflection: null,
        },
      ],
      trades: [],
      dateKey: today,
    });
    assert.ok(record.dailyScore >= 0 && record.dailyScore <= 100);
    assert.ok(record.lessonLearned.length > 10);
    assert.ok(record.tomorrowPlan.length > 10);
    assert.ok(record.ruleProposal.length > 5);
    assert.equal(record.date, today);
  });

  it("filters journal entries by UTC day", () => {
    const filtered = filterEntriesForUtcDay(
      [
        {
          id: "a",
          timestamp: "2026-06-06T10:00:00.000Z",
          btcPrice: 1,
          marketRegime: "x",
          agentOutputs: [],
          finalVerdict: "WAIT",
          riskVeto: false,
          topReasons: [],
          actionPlan: "",
          outcomeStatus: "PENDING",
          paperPnl: null,
          reflection: null,
        },
        {
          id: "b",
          timestamp: "2026-06-05T10:00:00.000Z",
          btcPrice: 1,
          marketRegime: "x",
          agentOutputs: [],
          finalVerdict: "WAIT",
          riskVeto: false,
          topReasons: [],
          actionPlan: "",
          outcomeStatus: "PENDING",
          paperPnl: null,
          reflection: null,
        },
      ],
      "2026-06-06",
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.id, "a");
  });
});
