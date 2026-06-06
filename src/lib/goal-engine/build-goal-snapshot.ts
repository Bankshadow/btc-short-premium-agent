import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { TestnetMonitorSnapshot } from "@/lib/testnet-monitor/types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { UnifiedPortfolioSnapshot } from "@/lib/portfolio/unified-types";
import {
  GOAL_MIN_TRADES_FOR_TRUST,
  GOAL_START_CAPITAL,
  GOAL_TARGET_CAPITAL,
  type AIActivitySnapshot,
  type AIActivityStatus,
  type CurrentPositionSummary,
  type EquitySnapshot,
  type GoalEngineInput,
  type GoalEnvironment,
  type GoalEnvironmentBreakdown,
  type GoalProgressSnapshot,
  type GoalRiskSummary,
  type ProfitMission,
  type TradeStatsSnapshot,
  type UserActionItem,
  type UserActionRequired,
} from "./types";

interface NormalizedTrade {
  environment: GoalEnvironment;
  symbol: string;
  side: string;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  isClosed: boolean;
  result: "WIN" | "LOSS" | "BREAKEVEN";
  closedAt: string | null;
}

function round(n: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function classify(pnl: number): "WIN" | "LOSS" | "BREAKEVEN" {
  if (pnl > 0.0001) return "WIN";
  if (pnl < -0.0001) return "LOSS";
  return "BREAKEVEN";
}

function emptyStats(): TradeStatsSnapshot {
  return {
    totalTrades: 0,
    winTrades: 0,
    lossTrades: 0,
    breakevenTrades: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    currentStreak: 0,
    bestTrade: 0,
    worstTrade: 0,
  };
}

function paperOrderToUsd(order: PaperOrder): number {
  const pct = order.realizedPnlPct ?? 0;
  const notional = order.notionalUsd || 0;
  return (pct / 100) * notional;
}

function normalizePaperOrders(orders: PaperOrder[]): NormalizedTrade[] {
  const out: NormalizedTrade[] = [];
  for (const order of orders) {
    if (order.isDemoData) continue;
    const env: GoalEnvironment =
      order.paperMode === "RELAXED_PAPER" ? "SHADOW" : "PAPER";
    const isClosed = order.status === "CLOSED";
    const realized = isClosed ? round(paperOrderToUsd(order)) : 0;
    const unrealized =
      !isClosed && order.unrealizedPnlPct != null
        ? round(((order.unrealizedPnlPct ?? 0) / 100) * (order.notionalUsd || 0))
        : 0;
    out.push({
      environment: env,
      symbol: order.symbol,
      side: order.side,
      realizedPnlUsd: realized,
      unrealizedPnlUsd: unrealized,
      isClosed,
      result: classify(realized),
      closedAt: order.closedAt,
    });
  }
  return out;
}

function normalizeUnified(
  snapshot: UnifiedPortfolioSnapshot | null | undefined,
): NormalizedTrade[] {
  if (!snapshot) return [];
  const out: NormalizedTrade[] = [];
  for (const trade of snapshot.closedTrades) {
    const env: GoalEnvironment =
      trade.paperMode === "RELAXED_PAPER" ? "SHADOW" : "PAPER";
    out.push({
      environment: env,
      symbol: trade.symbol,
      side: trade.side,
      realizedPnlUsd: round(trade.realizedPnlUsd ?? 0),
      unrealizedPnlUsd: 0,
      isClosed: true,
      result: classify(trade.realizedPnlUsd ?? 0),
      closedAt: trade.closedAt,
    });
  }
  for (const pos of snapshot.openPositions) {
    const env: GoalEnvironment =
      pos.paperMode === "RELAXED_PAPER" ? "SHADOW" : "PAPER";
    out.push({
      environment: env,
      symbol: pos.symbol,
      side: pos.side,
      realizedPnlUsd: 0,
      unrealizedPnlUsd: round(pos.unrealizedPnlUsd ?? 0),
      isClosed: false,
      result: "BREAKEVEN",
      closedAt: null,
    });
  }
  return out;
}

function normalizeTestnet(
  snapshot: TestnetMonitorSnapshot | null | undefined,
): NormalizedTrade[] {
  if (!snapshot) return [];
  const out: NormalizedTrade[] = [];
  for (const trade of snapshot.closedTrades) {
    out.push({
      environment: "TESTNET",
      symbol: trade.symbol,
      side: trade.side,
      realizedPnlUsd: round(trade.netPnl ?? 0),
      unrealizedPnlUsd: 0,
      isClosed: true,
      result: classify(trade.netPnl ?? 0),
      closedAt: trade.closedAt,
    });
  }
  for (const pos of snapshot.openPositions) {
    out.push({
      environment: "TESTNET",
      symbol: pos.symbol,
      side: pos.side,
      realizedPnlUsd: 0,
      unrealizedPnlUsd: round(pos.unrealizedPnl ?? 0),
      isClosed: false,
      result: "BREAKEVEN",
      closedAt: null,
    });
  }
  return out;
}

function normalizeLive(
  trades: LiveTradeJournalEntry[] | undefined,
): NormalizedTrade[] {
  if (!trades?.length) return [];
  const out: NormalizedTrade[] = [];
  for (const trade of trades) {
    const isClosed = trade.status === "CLOSED";
    const realized = isClosed ? round(trade.realizedPnl ?? 0) : 0;
    out.push({
      environment: "LIVE",
      symbol: trade.symbol,
      side: trade.side,
      realizedPnlUsd: realized,
      unrealizedPnlUsd: 0,
      isClosed,
      result: classify(realized),
      closedAt: trade.closedAt,
    });
  }
  return out;
}

function buildStats(trades: NormalizedTrade[]): TradeStatsSnapshot {
  const closed = trades.filter((t) => t.isClosed);
  if (closed.length === 0) return emptyStats();

  const wins = closed.filter((t) => t.result === "WIN");
  const losses = closed.filter((t) => t.result === "LOSS");
  const breakeven = closed.filter((t) => t.result === "BREAKEVEN");

  const grossWin = wins.reduce((s, t) => s + t.realizedPnlUsd, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.realizedPnlUsd, 0));

  const sorted = [...closed].sort((a, b) => {
    const aT = a.closedAt ? Date.parse(a.closedAt) : 0;
    const bT = b.closedAt ? Date.parse(b.closedAt) : 0;
    return aT - bT;
  });

  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const r = sorted[i]!.result;
    if (r === "BREAKEVEN") break;
    if (streak === 0) {
      streak = r === "WIN" ? 1 : -1;
    } else if (streak > 0 && r === "WIN") {
      streak += 1;
    } else if (streak < 0 && r === "LOSS") {
      streak -= 1;
    } else {
      break;
    }
  }

  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const t of sorted) {
    equity += t.realizedPnlUsd;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDd) maxDd = dd;
  }

  const pnls = closed.map((t) => t.realizedPnlUsd);

  return {
    totalTrades: closed.length,
    winTrades: wins.length,
    lossTrades: losses.length,
    breakevenTrades: breakeven.length,
    winRate: round((wins.length / closed.length) * 100, 1),
    avgWin: wins.length ? round(grossWin / wins.length) : 0,
    avgLoss: losses.length ? round(grossLoss / losses.length) : 0,
    profitFactor: grossLoss > 0 ? round(grossWin / grossLoss) : grossWin > 0 ? 99 : 0,
    maxDrawdown: round(maxDd),
    currentStreak: streak,
    bestTrade: round(Math.max(0, ...pnls)),
    worstTrade: round(Math.min(0, ...pnls)),
  };
}

function buildEquity(
  scopeLabel: string,
  startCapital: number,
  trades: NormalizedTrade[],
  generatedAt: string,
): EquitySnapshot {
  const realized = round(trades.reduce((s, t) => s + t.realizedPnlUsd, 0));
  const unrealized = round(trades.reduce((s, t) => s + t.unrealizedPnlUsd, 0));
  const netPnl = round(realized + unrealized);
  const openExposureUsd = round(
    trades.filter((t) => !t.isClosed).reduce((s, t) => s + Math.abs(t.unrealizedPnlUsd), 0),
  );
  return {
    scopeLabel,
    startCapital,
    currentEquity: round(startCapital + netPnl),
    realizedPnl: realized,
    unrealizedPnl: unrealized,
    netPnl,
    openExposureUsd,
    updatedAt: generatedAt,
  };
}

function buildBreakdown(
  environment: GoalEnvironment,
  startCapital: number,
  all: NormalizedTrade[],
  generatedAt: string,
): GoalEnvironmentBreakdown {
  const scoped = all.filter((t) => t.environment === environment);
  return {
    environment,
    tradeStats: buildStats(scoped),
    equity: buildEquity(environment, startCapital, scoped, generatedAt),
  };
}

function buildMission(
  startCapital: number,
  targetCapital: number,
  equity: EquitySnapshot,
  generatedAt: string,
): ProfitMission {
  const currentEquity = equity.currentEquity;
  const netPnl = equity.netPnl;
  const gain = currentEquity - startCapital;
  const span = targetCapital - startCapital;
  const progressPct = span > 0 ? round(Math.max(0, (gain / span) * 100), 1) : 0;
  return {
    startCapital,
    targetCapital,
    currentEquity,
    netPnl,
    progressPct,
    remainingToTarget: round(Math.max(0, targetCapital - currentEquity)),
    targetMultiple: round(targetCapital / startCapital, 2),
    currentMultiple: round(currentEquity / startCapital, 2),
    updatedAt: generatedAt,
  };
}

function resolveAiStatus(
  input: GoalEngineInput["ai"],
  hasOpenPosition: boolean,
  blocked: boolean,
): AIActivityStatus {
  if (blocked) return "BLOCKED";
  if (hasOpenPosition) return "IN_TRADE";
  if (!input) return "IDLE";
  if (input.automationPaused || input.automationEnabled === false) return "WAITING";
  if (input.lastRunStatus === "RUNNING") return "ANALYZING";
  if (input.automationEnabled) return "MONITORING";
  return "IDLE";
}

function buildAiActivity(
  input: GoalEngineInput,
  currentPosition: CurrentPositionSummary | null,
  blocker: string | null,
  generatedAt: string,
): AIActivitySnapshot {
  const ai = input.ai;
  const blocked = Boolean(blocker);
  const status = resolveAiStatus(ai, Boolean(currentPosition), blocked);

  const lastActionMap: Record<AIActivityStatus, string> = {
    IDLE: "AI is idle and waiting to be started.",
    ANALYZING: "AI is reviewing the market.",
    MONITORING: "AI is watching the market for the next setup.",
    IN_TRADE: "AI is managing an open position.",
    WAITING: "AI is paused and waiting for your approval.",
    BLOCKED: "AI paused itself because of a safety blocker.",
  };

  const nextActionMap: Record<AIActivityStatus, string> = {
    IDLE: "Press Start AI to begin market reviews.",
    ANALYZING: "Decide whether to trade once the review finishes.",
    MONITORING: "Open a testnet/paper trade when a good setup appears.",
    IN_TRADE: "Watch the position and close when the target or stop is hit.",
    WAITING: "Resume AI when you are ready.",
    BLOCKED: "Clear the safety blocker before AI can continue.",
  };

  const humanActionRequired = blocked || status === "WAITING";

  return {
    status,
    lastAction: lastActionMap[status],
    currentPositionSummary: currentPosition
      ? `${currentPosition.environment} ${currentPosition.symbol} ${currentPosition.side} · unrealized ${currentPosition.unrealizedPnlUsd >= 0 ? "+" : ""}$${currentPosition.unrealizedPnlUsd.toFixed(2)}`
      : "No open position right now.",
    nextPlannedAction: nextActionMap[status],
    humanActionRequired,
    reason: blocker
      ? blocker
      : status === "WAITING"
        ? "AI is paused. It will not trade until you resume it."
        : ai?.lastVerdict
          ? `Last market read: ${ai.lastVerdict}.`
          : "Running normally.",
    updatedAt: generatedAt,
  };
}

function pickCurrentPosition(
  input: GoalEngineInput,
): CurrentPositionSummary | null {
  const testnetOpen = input.testnetSnapshot?.openPositions?.[0];
  if (testnetOpen) {
    return {
      environment: "TESTNET",
      symbol: testnetOpen.symbol,
      side: testnetOpen.side,
      entryPrice: testnetOpen.entryPrice,
      markPrice: testnetOpen.markPrice,
      unrealizedPnlUsd: round(testnetOpen.unrealizedPnl ?? 0),
      canCloseOnTestnet: true,
    };
  }
  const paperOpen = input.unifiedPortfolio?.openPositions?.[0];
  if (paperOpen) {
    return {
      environment: paperOpen.paperMode === "RELAXED_PAPER" ? "SHADOW" : "PAPER",
      symbol: paperOpen.symbol,
      side: paperOpen.side,
      entryPrice: paperOpen.entryPrice,
      markPrice: null,
      unrealizedPnlUsd: round(paperOpen.unrealizedPnlUsd ?? 0),
      canCloseOnTestnet: false,
    };
  }
  return null;
}

export function buildGoalProgressSnapshot(
  input: GoalEngineInput,
): GoalProgressSnapshot {
  const generatedAt = new Date().toISOString();
  const startCapital = input.startCapital ?? GOAL_START_CAPITAL;
  const targetCapital = input.targetCapital ?? GOAL_TARGET_CAPITAL;
  const minTradesForTrust = input.minTradesForTrust ?? GOAL_MIN_TRADES_FOR_TRUST;

  const paperTrades = [
    ...normalizePaperOrders(input.orders ?? []),
    ...(input.orders?.length ? [] : normalizeUnified(input.unifiedPortfolio)),
  ];
  const testnetTrades = normalizeTestnet(input.testnetSnapshot);
  const liveTrades = normalizeLive(input.liveTrades);

  const nonLiveTrades = [...paperTrades, ...testnetTrades];
  const allTrades = [...nonLiveTrades, ...liveTrades];

  const byEnvironment: Record<GoalEnvironment, GoalEnvironmentBreakdown> = {
    PAPER: buildBreakdown("PAPER", startCapital, allTrades, generatedAt),
    SHADOW: buildBreakdown("SHADOW", startCapital, allTrades, generatedAt),
    TESTNET: buildBreakdown("TESTNET", startCapital, allTrades, generatedAt),
    LIVE: buildBreakdown("LIVE", startCapital, allTrades, generatedAt),
  };

  // Default mission scope: PAPER + SHADOW + TESTNET combined (never LIVE / DEMO).
  const combinedScopeLabel = "Paper + Testnet (practice money)";
  const equity = buildEquity(
    combinedScopeLabel,
    startCapital,
    nonLiveTrades,
    generatedAt,
  );
  const tradeStats = buildStats(nonLiveTrades);
  const mission = buildMission(startCapital, targetCapital, equity, generatedAt);

  const currentPosition = pickCurrentPosition(input);

  const blocker =
    input.risk?.blocker ??
    (input.ai?.riskBlocked ? input.ai?.blockerReason ?? "Risk engine blocked new trades." : null);

  const aiActivity = buildAiActivity(input, currentPosition, blocker, generatedAt);

  const risk: GoalRiskSummary = {
    dailyLossStatus: input.risk?.dailyLossStatus ?? "Within safe daily loss limit.",
    openRiskUsd: equity.openExposureUsd,
    liveLocked: input.risk?.liveLocked ?? true,
    blocker,
  };

  const trustReady = tradeStats.totalTrades >= minTradesForTrust;

  const userActionRequired = buildUserActions({
    aiActivity,
    blocker,
    currentPosition,
    liveBreakdown: byEnvironment.LIVE,
  });

  return {
    generatedAt,
    scope: "PAPER_TESTNET_COMBINED",
    scopeLabel: combinedScopeLabel,
    mission,
    tradeStats,
    equity,
    aiActivity,
    userActionRequired,
    currentPosition,
    risk,
    byEnvironment,
    live: byEnvironment.LIVE,
    minTradesForTrust,
    trustReady,
  };
}

function buildUserActions(input: {
  aiActivity: AIActivitySnapshot;
  blocker: string | null;
  currentPosition: CurrentPositionSummary | null;
  liveBreakdown: GoalEnvironmentBreakdown;
}): UserActionRequired {
  const items: UserActionItem[] = [];

  if (input.blocker) {
    items.push({
      id: "risk_blocker",
      title: "AI is paused by a safety blocker.",
      detail: input.blocker,
      severity: "CRITICAL",
      href: "/ai-status",
    });
  }

  if (input.aiActivity.status === "WAITING") {
    items.push({
      id: "ai_waiting",
      title: "AI is waiting for you.",
      detail: "Resume AI to continue market reviews.",
      severity: "WARNING",
      href: "/ai-status",
    });
  }

  if (input.currentPosition?.canCloseOnTestnet) {
    items.push({
      id: "open_testnet_position",
      title: "There is an open testnet position.",
      detail: `${input.currentPosition.symbol} ${input.currentPosition.side}. Review or close it from Trades.`,
      severity: "INFO",
      href: "/trades",
    });
  }

  return {
    required: items.some((i) => i.severity !== "INFO"),
    items,
  };
}
