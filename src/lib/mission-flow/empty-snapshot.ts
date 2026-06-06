import {
  GOAL_MIN_TRADES_FOR_TRUST,
  GOAL_START_CAPITAL,
  GOAL_TARGET_CAPITAL,
} from "@/lib/goal-engine/types";
import type { MissionFlowSnapshot } from "./types";

/** Client + server zero-state — never leaves UI in permanent Loading. */
export function emptyMissionFlowSnapshot(): MissionFlowSnapshot {
  return {
    startCapital: GOAL_START_CAPITAL,
    targetCapital: GOAL_TARGET_CAPITAL,
    currentEquity: GOAL_START_CAPITAL,
    progressPct: 0,
    remainingToTarget: GOAL_TARGET_CAPITAL - GOAL_START_CAPITAL,
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
      state: "IDLE",
      lastAction: "No AI cycle has run yet.",
      nextAction: "Run first AI cycle or connect Binance Testnet.",
      humanActionRequired: true,
    },
    binanceTestnet: {
      status: "DISCONNECTED",
      reason: "Not connected yet.",
      proxyProvider: null,
    },
    lastUpdatedAt: new Date().toISOString(),
    lastCycleAt: null,
    lastVerdict: null,
    latestDecisionLogId: null,
    lastDeskRunId: null,
    risk: {
      liveLocked: true,
      testnetStatus: "Binance Testnet is not connected yet.",
      blocker: null,
    },
    trust: {
      completedTrades: 0,
      minRequired: GOAL_MIN_TRADES_FOR_TRUST,
      ready: false,
    },
    nextRecommendation: "Run first AI cycle or connect Binance Testnet.",
    scopeLabel: "Paper + Testnet (practice money)",
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
    },
    notifications: {
      telegramConfigured: false,
      notifyOnTrade: true,
      notifyOnBlocker: true,
      lastAlertAt: null,
    },
  };
}
