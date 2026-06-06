import type { GoalDashboardServerPayload } from "@/lib/goal-engine/build-server-context";
import { emptyMissionFlowSnapshot } from "./empty-snapshot";
import type {
  BinanceTestnetFlowStatus,
  MissionFlowSnapshot,
} from "./types";

function resolveBinanceFlowStatus(
  binance: GoalDashboardServerPayload["binance"],
): { status: BinanceTestnetFlowStatus; reason: string } {
  if (!binance.configured) {
    return {
      status: "DISCONNECTED",
      reason: "Missing BINANCE_API_KEY / BINANCE_API_SECRET in server env.",
    };
  }
  if (binance.connected) {
    return { status: "CONNECTED", reason: "connected" };
  }
  const err = (binance.error ?? binance.blocker ?? "").toLowerCase();
  if (err.includes("451") || err.includes("restricted location") || err.includes("geo")) {
    return {
      status: "BLOCKED",
      reason: binance.error ?? binance.blocker ?? "HTTP 451 — region blocked by Binance.",
    };
  }
  if (err.includes("proxy") || err.includes("unauthorized")) {
    return {
      status: "BLOCKED",
      reason: binance.error ?? binance.blocker ?? "Proxy or API error.",
    };
  }
  return {
    status: "DISCONNECTED",
    reason: binance.error ?? binance.blocker ?? "API keys configured but not connected.",
  };
}

function buildNextRecommendation(payload: GoalDashboardServerPayload): string {
  const { goal, mission, binance } = payload;
  const binanceFlow = resolveBinanceFlowStatus(binance);

  if (binanceFlow.status !== "CONNECTED") {
    return "Connect Binance Testnet — configure API keys and proxy if needed.";
  }
  if (mission.totalTrades === 0 && !goal.lastCycleAt) {
    return "Run first AI cycle to start market reviews.";
  }
  if (mission.totalTrades === 0 && goal.lastCycleAt) {
    return "AI cycle ran but no trades yet. Wait for a TRADE verdict or create a testnet preview.";
  }
  if (!mission.trustReady) {
    return `${mission.totalTrades} / ${mission.minTradesForTrust} completed trades — keep AI running on testnet.`;
  }
  if (mission.pendingLearningReview > 0) {
    return `Review ${mission.pendingLearningReview} closed trade(s) so AI can learn.`;
  }
  if (goal.risk.blocker) {
    return `Clear blocker: ${goal.risk.blocker}`;
  }
  if (goal.aiActivity.status === "WAITING") {
    return "Resume AI autopilot when ready.";
  }
  return goal.primaryCta.description || mission.nextAction;
}

export function buildMissionFlowSnapshot(
  payload: GoalDashboardServerPayload,
  latestDecisionLogId: string | null,
  openTrades: number,
): MissionFlowSnapshot {
  const base = emptyMissionFlowSnapshot();
  const { goal, mission, binance, engines } = payload;
  const binanceFlow = resolveBinanceFlowStatus(binance);

  const currentPosition = goal.currentPosition
    ? {
        environment: goal.currentPosition.environment,
        symbol: goal.currentPosition.symbol,
        side: goal.currentPosition.side,
        entryPrice: goal.currentPosition.entryPrice,
        markPrice: goal.currentPosition.markPrice,
        unrealizedPnlUsd: goal.currentPosition.unrealizedPnlUsd,
        summary:
          mission.currentPositionSummary ??
          `${goal.currentPosition.symbol} ${goal.currentPosition.side}`,
      }
    : null;

  const hasCycle = Boolean(goal.lastCycleAt || mission.lastDeskRunId);

  return {
    startCapital: mission.startCapital,
    targetCapital: mission.targetCapital,
    currentEquity: mission.currentEquity,
    progressPct: mission.progressPct,
    remainingToTarget: mission.remainingToTarget,
    netPnl: mission.netPnl,
    realizedPnl: mission.realizedPnl,
    unrealizedPnl: mission.unrealizedPnl,
    totalTrades: mission.totalTrades,
    openTrades,
    closedTrades: mission.totalTrades,
    wins: mission.winTrades,
    losses: mission.lossTrades,
    breakeven: mission.breakevenTrades,
    winRate: mission.totalTrades > 0 ? mission.winRate : null,
    maxDrawdown: goal.tradeStats.maxDrawdown,
    currentPosition,
    aiStatus: {
      state: hasCycle ? mission.aiStatus : "IDLE",
      lastAction: hasCycle
        ? goal.aiActivity.lastAction
        : "No AI cycle has run yet.",
      nextAction: mission.nextAction,
      humanActionRequired: mission.humanActionRequired,
    },
    binanceTestnet: {
      status: binanceFlow.status,
      reason: binanceFlow.reason,
      proxyProvider: binance.proxyEnabled ? binance.proxyProvider : null,
    },
    lastUpdatedAt: mission.lastUpdatedAt,
    lastCycleAt: mission.lastCycleAt,
    lastVerdict: mission.lastVerdict,
    latestDecisionLogId,
    lastDeskRunId: mission.lastDeskRunId,
    risk: {
      liveLocked: goal.risk.liveLocked,
      testnetStatus: goal.risk.testnetStatus,
      blocker: goal.risk.blocker,
    },
    trust: {
      completedTrades: mission.totalTrades,
      minRequired: mission.minTradesForTrust,
      ready: mission.trustReady,
    },
    nextRecommendation: buildNextRecommendation(payload),
    scopeLabel: mission.scopeLabel,
    enginesNeedingAttention: engines.visibleEngines.length,
    learnedTrades: mission.learnedTrades,
    pendingLearningReview: mission.pendingLearningReview,
  };
}
