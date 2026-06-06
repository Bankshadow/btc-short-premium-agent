import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { parseTelegramCommand, isAuthorizedOperatorChat } from "./auth";
import { detectPermissionPrompt } from "./permission-prompt";
import { expirePermissionPrompt } from "./permission-prompt";
import { resetTelegramControlForTests } from "./store";
import { formatHelpMessage, formatPermissionPromptMessage } from "./format-messages";
import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";

function baseMission(
  partial: Partial<MissionFlowSnapshot> = {},
): MissionFlowSnapshot {
  return {
    startCapital: 1000,
    targetCapital: 10000,
    currentEquity: 1200,
    progressPct: 2,
    remainingToTarget: 8800,
    netPnl: 200,
    realizedPnl: 150,
    unrealizedPnl: 50,
    totalTrades: 3,
    openTrades: 1,
    closedTrades: 2,
    wins: 1,
    losses: 1,
    breakeven: 0,
    winRate: 50,
    maxDrawdown: 0,
    currentPosition: null,
    pendingTestnetPreview: null,
    aiStatus: {
      state: "MONITORING",
      lastAction: "Cycle",
      nextAction: "Wait",
      humanActionRequired: false,
    },
    binanceTestnet: { status: "CONNECTED", reason: "", proxyProvider: null },
    lastUpdatedAt: new Date().toISOString(),
    lastCycleAt: null,
    lastVerdict: null,
    latestDecisionLogId: null,
    lastDeskRunId: null,
    risk: { liveLocked: true, testnetStatus: "OK", blocker: null },
    trust: { completedTrades: 2, minRequired: 10, ready: false },
    nextRecommendation: "Hold",
    scopeLabel: "testnet",
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
      telegramConfigured: true,
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
    trustNotionalUsd: 55,
    selfLearning: {
      serverEvaluated: 0,
      lastTopAgent: null,
      lastEvaluatedAt: null,
    },
    ...partial,
  };
}

describe("Telegram control channel (MVP 77)", () => {
  beforeEach(async () => {
    await resetTelegramControlForTests();
    process.env.TELEGRAM_CHAT_ID = "12345";
  });

  it("parses bot username from commands", () => {
    const parsed = parseTelegramCommand("/status@MyBot arg");
    assert.equal(parsed.command, "/status");
    assert.equal(parsed.args, "arg");
  });

  it("authorizes configured operator chat", () => {
    assert.equal(isAuthorizedOperatorChat("12345"), true);
    assert.equal(isAuthorizedOperatorChat(12345), true);
    assert.equal(isAuthorizedOperatorChat("999"), false);
  });

  it("detects execute permission from pending preview", () => {
    const detected = detectPermissionPrompt({
      mission: baseMission({
        pendingTestnetPreview: {
          previewId: "p1",
          symbol: "BTCUSDT",
          side: "SELL",
          notionalUsd: 55,
          estimatedQty: "0.001",
          markPrice: 90000,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          blocked: false,
          blockReasons: [],
          reason: "test",
          decisionLogId: null,
        },
        aiStatus: {
          state: "WAITING",
          lastAction: "Preview",
          nextAction: "Confirm",
          humanActionRequired: true,
        },
      }),
    });
    assert.ok(detected);
    assert.equal(detected?.kind, "EXECUTE_TESTNET");
    assert.equal(detected?.previewId, "p1");
  });

  it("expires stale permission prompts", () => {
    const expired = expirePermissionPrompt({
      promptId: "p",
      kind: "EXECUTE_TESTNET",
      createdAt: new Date(Date.now() - 600_000).toISOString(),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      status: "PENDING",
      summary: "old",
    });
    assert.equal(expired.status, "EXPIRED");
  });

  it("formats help without secrets", () => {
    const help = formatHelpMessage();
    assert.ok(help.includes("/approve"));
    assert.ok(!help.includes("TELEGRAM_BOT_TOKEN"));
  });

  it("formats permission prompt with approve/deny", () => {
    const text = formatPermissionPromptMessage({
      promptId: "p",
      kind: "CLOSE_TESTNET",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      status: "PENDING",
      summary: "Close BTCUSDT",
      symbol: "BTCUSDT",
      side: "SHORT",
    });
    assert.ok(text.includes("/approve"));
    assert.ok(text.includes("/deny"));
    assert.ok(text.toLowerCase().includes("reduce-only"));
  });
});
