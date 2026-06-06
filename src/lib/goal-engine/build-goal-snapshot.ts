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
  type PrimaryCta,
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

function formatDuration(openedAt: string | null | undefined): string | null {
  if (!openedAt) return null;
  const ms = Date.now() - Date.parse(openedAt);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
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
    IDLE: "Autopilot will analyze on the next scheduled cycle.",
    ANALYZING: "Market review in progress — trade decision follows verdict.",
    MONITORING: "Watching for the next TRADE setup on testnet.",
    IN_TRADE: "Managing open position — close on target, stop, or autopilot rule.",
    WAITING: "Resume autopilot when you are ready.",
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
      openedAt: testnetOpen.openedAt,
      durationLabel: formatDuration(testnetOpen.openedAt),
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
      openedAt: paperOpen.createdAt,
      durationLabel: formatDuration(paperOpen.createdAt),
      canCloseOnTestnet: false,
    };
  }
  return null;
}

function buildPrimaryCta(input: {
  entriesCount: number;
  totalTrades: number;
  testnetConfigured: boolean;
  testnetConnected: boolean;
  currentPosition: CurrentPositionSummary | null;
  aiStatus: AIActivityStatus;
  automationPaused?: boolean;
  pendingLearningReview: number;
}): PrimaryCta {
  if (!input.testnetConfigured || !input.testnetConnected) {
    return {
      label: "Configure Binance Testnet",
      href: "/binance-testnet",
      description: "Connect Binance Testnet so AI can place practice orders.",
    };
  }
  if (input.entriesCount === 0 && input.totalTrades === 0) {
    return {
      label: "Run First AI Cycle",
      href: "/cockpit",
      description: "Start the first market review to begin your $1,000 → $10,000 mission.",
    };
  }
  if (input.pendingLearningReview > 0) {
    return {
      label: "Resolve Closed Trade",
      href: "/learning",
      description: `${input.pendingLearningReview} closed trade(s) need review so AI can learn.`,
    };
  }
  if (input.currentPosition) {
    return {
      label: "View Current Trade",
      href: "/trades",
      description: `Open ${input.currentPosition.symbol} ${input.currentPosition.side} position.`,
    };
  }
  if (input.aiStatus === "WAITING" || input.automationPaused) {
    return {
      label: "Start Paper/Testnet Autopilot",
      href: "/ai-status",
      description: "Resume AI so it can watch the market and trade on testnet.",
    };
  }
  return {
    label: "Run First AI Cycle",
    href: "/cockpit",
    description: "Run a fresh AI market review.",
  };
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

  const testnetConfigured = input.risk?.testnetConfigured ?? false;
  const testnetConnected = input.risk?.testnetConnected ?? false;
  const testnetStatus = !testnetConfigured
    ? "Binance Testnet is not connected yet."
    : testnetConnected
      ? "Binance Testnet connected."
      : "Binance Testnet is not connected yet.";

  const risk: GoalRiskSummary = {
    dailyLossStatus: input.risk?.dailyLossStatus ?? "Within safe daily loss limit.",
    dailyLossLimitLabel: input.risk?.dailyLossLimitLabel ?? "3% daily loss limit",
    openRiskUsd: equity.openExposureUsd,
    liveLocked: input.risk?.liveLocked ?? true,
    testnetStatus,
    blocker,
  };

  const trustReady = tradeStats.totalTrades >= minTradesForTrust;
  const dataConnected =
    tradeStats.totalTrades > 0 ||
    (input.entries?.length ?? 0) > 0 ||
    Boolean(input.lastDeskRun) ||
    testnetConnected ||
    Boolean(input.unifiedPortfolio);

  const zeroStateMessage = dataConnected
    ? null
    : "Trade data is not connected yet. Run your first AI cycle or connect Binance Testnet.";

  const pendingLearningReview = input.learning?.pendingReview ?? 0;

  const primaryCta = buildPrimaryCta({
    entriesCount: input.entries?.length ?? 0,
    totalTrades: tradeStats.totalTrades,
    testnetConfigured,
    testnetConnected,
    currentPosition,
    aiStatus: aiActivity.status,
    automationPaused: input.ai?.automationPaused,
    pendingLearningReview,
  });

  const userActionRequired = buildUserActions({
    aiActivity,
    blocker,
    currentPosition,
    testnetConfigured,
    testnetConnected,
    dataConnected,
    pendingLearningReview,
    primaryCta,
  });

  const lastVerdict = input.ai?.lastVerdict ?? null;

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
    environmentBreakdown: byEnvironment,
    live: byEnvironment.LIVE,
    minTradesForTrust,
    trustReady,
    dataConnected,
    zeroStateMessage,
    primaryCta,
    currentStrategy: input.ai?.commandCenterStatus ?? null,
    lastCycleAt: input.ai?.lastRunAt ?? null,
    lastVerdict,
  };
}

function buildUserActions(input: {
  aiActivity: AIActivitySnapshot;
  blocker: string | null;
  currentPosition: CurrentPositionSummary | null;
  testnetConfigured: boolean;
  testnetConnected: boolean;
  dataConnected: boolean;
  pendingLearningReview: number;
  primaryCta: PrimaryCta;
}): UserActionRequired {
  const items: UserActionItem[] = [];

  if (!input.dataConnected) {
    items.push({
      id: "no_data",
      title: "Trade data is not connected yet.",
      detail: "Run your first AI cycle or connect Binance Testnet.",
      severity: "WARNING",
      href: input.primaryCta.href,
    });
  }

  if (!input.testnetConfigured || !input.testnetConnected) {
    items.push({
      id: "testnet_disconnected",
      title: "Binance Testnet is not connected yet.",
      detail: "Configure API keys and enable testnet to let AI place practice orders.",
      severity: "WARNING",
      href: "/binance-testnet",
    });
  }

  if (input.pendingLearningReview > 0) {
    items.push({
      id: "learning_pending",
      title: "Closed trades need review.",
      detail: `${input.pendingLearningReview} trade(s) waiting so AI can learn from outcomes.`,
      severity: "INFO",
      href: "/learning",
    });
  }

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
