import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";
import { resolveOneButtonAiState } from "./resolve-next-action";

function baseMission(
  patch: Partial<MissionFlowSnapshot> = {},
): MissionFlowSnapshot {
  return {
    startCapital: 1000,
    targetCapital: 10000,
    currentEquity: 1000,
    progressPct: 0,
    remainingToTarget: 9000,
    netPnl: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalTrades: 0,
    openTrades: 0,
    closedTrades: 0,
    wins: 0,
    losses: 0,
    breakeven: 0,
    winRate: null,
    maxDrawdown: 0,
    currentPosition: null,
    pendingTestnetPreview: null,
    aiStatus: {
      state: "MONITORING",
      lastAction: "idle",
      nextAction: "Continue",
      humanActionRequired: false,
    },
    binanceTestnet: { status: "CONNECTED", reason: "connected", proxyProvider: null },
    lastUpdatedAt: new Date().toISOString(),
    lastCycleAt: null,
    lastVerdict: null,
    latestDecisionLogId: null,
    lastDeskRunId: null,
    risk: { liveLocked: true, testnetStatus: "ok", blocker: null },
    trust: { completedTrades: 0, minRequired: 10, ready: false },
    nextRecommendation: "Start",
    scopeLabel: "TESTNET",
    enginesNeedingAttention: 0,
    learnedTrades: 0,
    pendingLearningReview: 0,
    learningPending: [],
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
    recentActivity: [],
    learningInsights: {
      learnedCount: 0,
      winCount: 0,
      lossCount: 0,
      avgR: null,
      recent: [],
    },
    strategyHealth: null,
    trustNotionalUsd: 100,
    selfLearning: { serverEvaluated: 0, lastTopAgent: null, lastEvaluatedAt: null },
    ...patch,
  };
}

describe("One Button AI Mode", () => {
  it("shows Start AI when no cycle has run", () => {
    const { state } = resolveOneButtonAiState({ mission: baseMission() });
    assert.equal(state.label, "Start AI");
    assert.equal(state.action, "RUN_FIRST_ANALYSIS");
  });

  it("shows Approve Testnet Order for pending preview", () => {
    const { state } = resolveOneButtonAiState({
      mission: baseMission({
        lastCycleAt: new Date().toISOString(),
        pendingTestnetPreview: {
          previewId: "prev-1",
          symbol: "BTCUSDT",
          side: "BUY",
          notionalUsd: 100,
          estimatedQty: "0.001",
          markPrice: 100000,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          blocked: false,
          blockReasons: [],
          reason: "ai",
          decisionLogId: "dec-1",
        },
      }),
    });
    assert.equal(state.label, "Approve testnet order");
    assert.equal(state.action, "ASK_PERMISSION_EXECUTE");
    assert.equal(state.requiresClientConfirm, true);
    assert.equal(state.confirmMode, "execute");
  });

  it("shows Resolve Issue when loop guard active", () => {
    const { state, blockers } = resolveOneButtonAiState({
      mission: baseMission({ lastCycleAt: new Date().toISOString() }),
      aiCard: {
        updatedAt: new Date().toISOString(),
        currentTask: "blocked",
        currentStep: "loop",
        progressPct: 0,
        permissionNeeded: true,
        permissionReason: "loop",
        estimatedNextAction: "fix",
        recentToolActions: [],
        isActive: false,
        runId: null,
        liveLocked: true,
        loopBlocker: {
          active: true,
          reason: "Repeated failures",
          riskLevel: "STUCK",
          actionDiversityPct: 10,
          successRatePct: 20,
          selfCheckSummary: null,
        },
        memorySummary: null,
        committeeSummary: null,
      },
    });
    assert.equal(state.label, "Resolve blocker");
    assert.equal(state.action, "PAUSE_IF_RISK");
    assert.ok(blockers.length > 0);
  });

  it("shows Continue Monitoring for open position", () => {
    const { state } = resolveOneButtonAiState({
      mission: baseMission({
        lastCycleAt: new Date().toISOString(),
        openTrades: 1,
        currentPosition: {
          environment: "TESTNET",
          symbol: "BTCUSDT",
          side: "LONG",
          entryPrice: 100000,
          markPrice: 100100,
          unrealizedPnlUsd: 1,
          summary: "BTCUSDT LONG",
          canCloseOnTestnet: true,
        },
      }),
    });
    assert.equal(state.label, "Monitor position");
    assert.equal(state.action, "MONITOR_POSITION");
  });

  it("shows Review Trade when learning review pending", () => {
    const { state } = resolveOneButtonAiState({
      mission: baseMission({
        lastCycleAt: new Date().toISOString(),
        pendingLearningReview: 2,
        automation: {
          enabled: true,
          paused: false,
          intervalMinutes: 15,
          lastRunAt: null,
          nextRunAt: null,
          lastRunStatus: null,
          lastTrigger: null,
          autoExecuteEnabled: false,
          autoLearnEnabled: false,
        },
      }),
    });
    assert.equal(state.label, "Review preview");
    assert.equal(state.action, "REVIEW_TRADE");
  });
});
