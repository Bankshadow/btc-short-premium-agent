import type { DeskRun } from "@/lib/data-backbone/types";
import type { BinanceStatusResult } from "@/lib/exchange/binance/binance-types";
import {
  GOAL_MIN_TRADES_FOR_TRUST,
  GOAL_START_CAPITAL,
  GOAL_TARGET_CAPITAL,
  type AIActivityStatus,
  type CurrentPositionSummary,
  type GoalProgressSnapshot,
  type MissionSnapshot,
  type MissionSnapshotInput,
} from "./types";
import { buildGoalProgressSnapshot } from "./build-goal-snapshot";

function round(n: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

export function emptyMissionSnapshot(
  overrides?: Partial<MissionSnapshot>,
): MissionSnapshot {
  const startCapital = overrides?.startCapital ?? GOAL_START_CAPITAL;
  const targetCapital = overrides?.targetCapital ?? GOAL_TARGET_CAPITAL;
  return {
    startCapital,
    targetCapital,
    currentEquity: startCapital,
    progressPct: 0,
    remainingToTarget: targetCapital - startCapital,
    netPnl: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalTrades: 0,
    winTrades: 0,
    lossTrades: 0,
    breakevenTrades: 0,
    winRate: 0,
    openPositionCount: 0,
    currentPositionSummary: null,
    aiStatus: "IDLE",
    humanActionRequired: false,
    nextAction: "Run first AI cycle or connect Binance Testnet",
    lastUpdatedAt: new Date().toISOString(),
    scopeLabel: "Paper + Testnet (practice money)",
    learnedTrades: 0,
    pendingLearningReview: 0,
    minTradesForTrust: GOAL_MIN_TRADES_FOR_TRUST,
    trustReady: false,
    dataConnected: false,
    lastDeskRunId: null,
    lastVerdict: null,
    lastCycleAt: null,
    primaryCtaLabel: "Run First AI Cycle",
    primaryCtaHref: "/",
    ...overrides,
  };
}

function countOpenPositions(goal: GoalProgressSnapshot): number {
  return goal.currentPosition ? 1 : 0;
}

function formatPositionSummary(pos: CurrentPositionSummary | null): string | null {
  if (!pos) return null;
  const pnl =
    pos.unrealizedPnlUsd >= 0
      ? `+$${pos.unrealizedPnlUsd.toFixed(2)}`
      : `-$${Math.abs(pos.unrealizedPnlUsd).toFixed(2)}`;
  return `${pos.environment} ${pos.symbol} ${pos.side} · unrealized ${pnl}`;
}

function resolveNextAction(goal: GoalProgressSnapshot): string {
  if (goal.risk.testnetStatus.toLowerCase().includes("not connected")) {
    return "Connect Binance Testnet";
  }
  if (goal.zeroStateMessage) {
    return goal.primaryCta.description || goal.zeroStateMessage;
  }
  return goal.aiActivity.nextPlannedAction || goal.primaryCta.description;
}

export function buildMissionSnapshotFromGoal(
  goal: GoalProgressSnapshot,
  extras?: {
    lastDeskRun?: DeskRun | null;
    learnedTrades?: number;
    pendingLearningReview?: number;
  },
): MissionSnapshot {
  const { mission, tradeStats, equity, aiActivity } = goal;
  const openPositionCount = countOpenPositions(goal);

  return {
    startCapital: mission.startCapital,
    targetCapital: mission.targetCapital,
    currentEquity: mission.currentEquity,
    progressPct: mission.progressPct,
    remainingToTarget: mission.remainingToTarget,
    netPnl: round(equity.netPnl),
    realizedPnl: round(equity.realizedPnl),
    unrealizedPnl: round(equity.unrealizedPnl),
    totalTrades: tradeStats.totalTrades,
    winTrades: tradeStats.winTrades,
    lossTrades: tradeStats.lossTrades,
    breakevenTrades: tradeStats.breakevenTrades,
    winRate: tradeStats.winRate,
    openPositionCount,
    currentPositionSummary:
      formatPositionSummary(goal.currentPosition) ?? aiActivity.currentPositionSummary,
    aiStatus: aiActivity.status,
    humanActionRequired: aiActivity.humanActionRequired || goal.userActionRequired.required,
    nextAction: resolveNextAction(goal),
    lastUpdatedAt: goal.generatedAt,
    scopeLabel: goal.scopeLabel,
    learnedTrades: extras?.learnedTrades ?? 0,
    pendingLearningReview: extras?.pendingLearningReview ?? 0,
    minTradesForTrust: goal.minTradesForTrust,
    trustReady: goal.trustReady,
    dataConnected: goal.dataConnected,
    lastDeskRunId: extras?.lastDeskRun?.runId ?? null,
    lastVerdict: goal.lastVerdict ?? extras?.lastDeskRun?.finalVerdict ?? null,
    lastCycleAt: goal.lastCycleAt ?? extras?.lastDeskRun?.completedAt ?? null,
    primaryCtaLabel: goal.primaryCta.label,
    primaryCtaHref: goal.primaryCta.href,
  };
}

export function buildMissionSnapshot(input: MissionSnapshotInput): MissionSnapshot {
  const goal = buildGoalProgressSnapshot(input);
  return buildMissionSnapshotFromGoal(goal, {
    lastDeskRun: input.lastDeskRun ?? null,
    learnedTrades: input.learning?.learnedCount ?? 0,
    pendingLearningReview: input.learning?.pendingReview ?? 0,
  });
}

export function resolveProxyProviderLabel(
  status: BinanceStatusResult | null | undefined,
): string {
  if (!status?.proxyEnabled) return "Direct (no proxy)";
  const url = status.baseUrl?.toLowerCase() ?? "";
  if (url.includes("fly.dev")) return "Fly.io (Singapore)";
  if (url.includes("workers.dev")) return "Cloudflare Worker";
  if (url.includes("railway")) return "Railway";
  if (url.includes("trycloudflare")) return "Cloudflare Quick Tunnel";
  return "Custom proxy";
}
