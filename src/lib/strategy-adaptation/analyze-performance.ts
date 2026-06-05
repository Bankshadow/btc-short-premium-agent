import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { PaperMode } from "@/lib/paper/paper-relaxed-types";
import { buildAgentScoreboard } from "@/lib/journal/agent-scoreboard";
import { buildUnifiedPortfolioSnapshot } from "@/lib/portfolio/build-unified-portfolio";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { UnifiedPortfolioSnapshot } from "@/lib/portfolio/unified-types";
import { buildStrategyRegistry } from "@/lib/strategy-registry/build-strategy-registry";
import type { StrategyRegistrySnapshot } from "@/lib/strategy-registry/strategy-registry-types";
import { ALL_STRATEGY_IDS, STRATEGY_LABELS } from "@/lib/validation/validation-config";
import { strategiesSignaledOnEntry } from "@/lib/validation/classify-strategy";
import type { StrategyId } from "@/lib/validation/validation-types";
import type {
  AdaptationPerformanceReport,
  AgentAccuracySlice,
  FailurePattern,
  RegimePerformanceSlice,
  StrategyPerformanceSlice,
  StrictRelaxedComparison,
} from "./types";
import { strategyIdFromLabel, strategyIdFromPaperOrder } from "./map-strategy";

interface StrategyAcc {
  wins: number;
  losses: number;
  pnlSum: number;
  pnlSeries: number[];
  samples: number;
}

function emptyAcc(): StrategyAcc {
  return { wins: 0, losses: 0, pnlSum: 0, pnlSeries: [], samples: 0 };
}

function maxDrawdown(series: number[]): number {
  let peak = 0;
  let equity = 0;
  let maxDd = 0;
  for (const r of series) {
    equity += r;
    if (equity > peak) peak = equity;
    maxDd = Math.max(maxDd, peak - equity);
  }
  return Number(maxDd.toFixed(2));
}

function paperModeCounts(orders: PaperOrder[]): Record<PaperMode, number> {
  return {
    STRICT_PAPER: orders.filter(
      (o) => (o.paperMode ?? "STRICT_PAPER") === "STRICT_PAPER",
    ).length,
    RELAXED_PAPER: orders.filter((o) => o.paperMode === "RELAXED_PAPER").length,
  };
}

function buildStrictRelaxed(orders: PaperOrder[]): StrictRelaxedComparison {
  const slice = (mode: PaperMode) => {
    const rows = orders.filter(
      (o) =>
        o.status === "CLOSED" &&
        (o.paperMode ?? "STRICT_PAPER") === mode,
    );
    const wins = rows.filter((o) => (o.realizedPnlPct ?? 0) > 0).length;
    const avg =
      rows.length > 0
        ? rows.reduce((s, o) => s + (o.realizedPnlPct ?? 0), 0) / rows.length
        : 0;
    return {
      trades: rows.length,
      winRate: rows.length ? Number(((wins / rows.length) * 100).toFixed(1)) : 0,
      avgPnlPct: Number(avg.toFixed(2)),
    };
  };
  return { strict: slice("STRICT_PAPER"), relaxed: slice("RELAXED_PAPER") };
}

function buildAgentAccuracy(entries: DecisionLogEntry[]): AgentAccuracySlice[] {
  const board = buildAgentScoreboard(entries);
  return board.agents.map((a) => {
    const correct = a.correctTradeCalls + a.correctSkips;
    const accuracy =
      a.totalCalls > 0 ? (correct / a.totalCalls) * 100 : 0;
    return {
      agentName: a.agentName,
      accuracyPct: Number(accuracy.toFixed(1)),
      totalCalls: a.totalCalls,
      falsePositives: a.falsePositives,
      falseNegatives: a.falseNegatives,
    };
  });
}

function detectFailurePatterns(
  entries: DecisionLogEntry[],
  orders: PaperOrder[],
): FailurePattern[] {
  const patterns: FailurePattern[] = [];
  const lossStreakByStrategy = new Map<StrategyId, number>();

  for (const order of orders.filter((o) => o.status === "CLOSED")) {
    const sid = strategyIdFromPaperOrder(order);
    const pnl = order.realizedPnlPct ?? 0;
    if (pnl < 0) {
      lossStreakByStrategy.set(sid, (lossStreakByStrategy.get(sid) ?? 0) + 1);
    } else {
      lossStreakByStrategy.set(sid, 0);
    }
    const streak = lossStreakByStrategy.get(sid) ?? 0;
    if (streak >= 3) {
      patterns.push({
        pattern: `${sid}: ${streak} consecutive paper losses`,
        count: streak,
        strategies: [sid],
        regimes: [],
      });
    }
  }

  const skipRegret = entries.filter((e) => e.falseSkipFlag).length;
  if (skipRegret >= 2) {
    patterns.push({
      pattern: "Repeated false SKIP — committee too conservative",
      count: skipRegret,
      strategies: ["options_short_premium"],
      regimes: [],
    });
  }

  const vetoLoss = entries.filter(
    (e) => e.riskVeto && (e.paperPnl ?? 0) < 0,
  ).length;
  if (vetoLoss >= 2) {
    patterns.push({
      pattern: "Risk veto followed by negative paper outcome",
      count: vetoLoss,
      strategies: [],
      regimes: [],
    });
  }

  return patterns;
}

export function analyzeAdaptationPerformance(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile: DeskRiskProfile;
  registry?: StrategyRegistrySnapshot;
  portfolio?: UnifiedPortfolioSnapshot;
  historicalBacktest?: import("@/lib/historical-backtest/types").BacktestAdaptationBridge | null;
}): AdaptationPerformanceReport {
  const registry =
    input.registry ??
    buildStrategyRegistry({
      entries: input.entries,
      orders: input.orders,
      riskProfile: input.riskProfile,
    });
  const portfolio =
    input.portfolio ??
    buildUnifiedPortfolioSnapshot({
      entries: input.entries,
      orders: input.orders,
      perpPositions: input.perpPositions ?? [],
      riskProfile: input.riskProfile,
    });

  const acc = new Map<StrategyId, StrategyAcc>();
  for (const id of ALL_STRATEGY_IDS) acc.set(id, emptyAcc());

  for (const entry of input.entries) {
    if (entry.outcomeStatus !== "RESOLVED") continue;
    const pnl = entry.paperPnl ?? 0;
    const win = pnl > 0;
    for (const sid of strategiesSignaledOnEntry(entry)) {
      const row = acc.get(sid) ?? emptyAcc();
      row.samples += 1;
      row.pnlSum += pnl;
      row.pnlSeries.push(pnl);
      if (win) row.wins += 1;
      else row.losses += 1;
      acc.set(sid, row);
    }
  }

  for (const order of input.orders.filter((o) => o.status === "CLOSED")) {
    const sid = strategyIdFromPaperOrder(order);
    const pnl = order.realizedPnlPct ?? 0;
    const row = acc.get(sid) ?? emptyAcc();
    if (!row.pnlSeries.length) {
      row.samples += 1;
      row.pnlSum += pnl;
      row.pnlSeries.push(pnl);
      if (pnl > 0) row.wins += 1;
      else row.losses += 1;
      acc.set(sid, row);
    }
  }

  const strategyPerformance: StrategyPerformanceSlice[] = registry.strategies.map(
    (skill) => {
      const row = acc.get(skill.id) ?? emptyAcc();
      const winRate =
        row.samples > 0 ? (row.wins / row.samples) * 100 : skill.winRate;
      const avgPnl =
        row.samples > 0 ? row.pnlSum / row.samples : skill.avgR;
      return {
        strategyId: skill.id,
        label: skill.name,
        winRate: Number(winRate.toFixed(1)),
        avgPnlPct: Number(avgPnl.toFixed(2)),
        maxDrawdownPct: maxDrawdown(row.pnlSeries) || skill.maxDrawdown,
        sampleSize: Math.max(row.samples, skill.sampleSize),
        totalPnlUsd: Number(row.pnlSum.toFixed(2)),
        currentStatus: skill.status,
      };
    },
  );

  const regimeMap = new Map<
    string,
    { wins: number; losses: number; pnl: number; n: number; byStrategy: Map<StrategyId, number> }
  >();

  for (const entry of input.entries.filter((e) => e.outcomeStatus === "RESOLVED")) {
    const regime = entry.marketRegime || "unknown";
    const row = regimeMap.get(regime) ?? {
      wins: 0,
      losses: 0,
      pnl: 0,
      n: 0,
      byStrategy: new Map(),
    };
    const pnl = entry.paperPnl ?? 0;
    row.n += 1;
    row.pnl += pnl;
    if (pnl > 0) row.wins += 1;
    else row.losses += 1;
    for (const sid of strategiesSignaledOnEntry(entry)) {
      row.byStrategy.set(sid, (row.byStrategy.get(sid) ?? 0) + pnl);
    }
    regimeMap.set(regime, row);
  }

  const regimePerformance: RegimePerformanceSlice[] = [...regimeMap.entries()].map(
    ([regime, row]) => {
      let best: StrategyId | null = null;
      let worst: StrategyId | null = null;
      let bestPnl = -Infinity;
      let worstPnl = Infinity;
      for (const [sid, pnl] of row.byStrategy) {
        if (pnl > bestPnl) {
          bestPnl = pnl;
          best = sid;
        }
        if (pnl < worstPnl) {
          worstPnl = pnl;
          worst = sid;
        }
      }
      return {
        regime,
        winRate: row.n > 0 ? Number(((row.wins / row.n) * 100).toFixed(1)) : 0,
        avgPnlPct: row.n > 0 ? Number((row.pnl / row.n).toFixed(2)) : 0,
        sampleSize: row.n,
        bestStrategy: best,
        worstStrategy: worst,
      };
    },
  );

  for (const slice of portfolio.pnlByAsset) {
    const sid = strategyIdFromLabel(slice.key) ?? "futures_long";
    const row = acc.get(sid);
    if (row && slice.tradeCount > row.samples) {
      row.samples = slice.tradeCount;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    riskProfile: input.riskProfile,
    paperModeSummary: paperModeCounts(input.orders),
    strategyPerformance,
    regimePerformance,
    agentAccuracy: buildAgentAccuracy(input.entries),
    strictVsRelaxed: buildStrictRelaxed(input.orders),
    failurePatterns: detectFailurePatterns(input.entries, input.orders),
    historicalBacktest: input.historicalBacktest ?? null,
  };
}

export { STRATEGY_LABELS };
