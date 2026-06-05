import type {
  EquityCurvePoint,
  ExposureSlice,
  PnlSlice,
  UnifiedPaperPosition,
  UnifiedPaperTrade,
  UnifiedPortfolioMetrics,
} from "./unified-types";
import { UNIFIED_PORTFOLIO_BASE_EQUITY_USD } from "./unified-types";

function sum(nums: number[]): number {
  return Number(nums.reduce((a, b) => a + b, 0).toFixed(2));
}

function groupExposure(
  open: UnifiedPaperPosition[],
  keyFn: (p: UnifiedPaperPosition) => string,
): ExposureSlice[] {
  const total = sum(open.map((p) => p.notionalUsd));
  const map = new Map<string, { notional: number; count: number }>();
  for (const p of open) {
    const key = keyFn(p);
    const row = map.get(key) ?? { notional: 0, count: 0 };
    row.notional += p.notionalUsd;
    row.count += 1;
    map.set(key, row);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      notionalUsd: Number(v.notional.toFixed(2)),
      pctOfBook: total > 0 ? Number(((v.notional / total) * 100).toFixed(1)) : 0,
      openCount: v.count,
    }))
    .sort((a, b) => b.notionalUsd - a.notionalUsd);
}

function groupPnl(
  positions: UnifiedPaperPosition[],
  keyFn: (p: UnifiedPaperPosition) => string,
): PnlSlice[] {
  const map = new Map<
    string,
    { realized: number; unrealized: number; count: number }
  >();
  for (const p of positions) {
    const key = keyFn(p);
    const row = map.get(key) ?? { realized: 0, unrealized: 0, count: 0 };
    row.realized += p.realizedPnlUsd;
    row.unrealized += p.unrealizedPnlUsd;
    row.count += 1;
    map.set(key, row);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      realizedUsd: Number(v.realized.toFixed(2)),
      unrealizedUsd: Number(v.unrealized.toFixed(2)),
      totalUsd: Number((v.realized + v.unrealized).toFixed(2)),
      tradeCount: v.count,
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd);
}

export function buildEquityCurve(
  closed: UnifiedPaperTrade[],
  baseEquityUsd: number,
): EquityCurvePoint[] {
  const sorted = [...closed]
    .filter((t) => t.closedAt)
    .sort(
      (a, b) =>
        new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime(),
    );

  let cumulative = 0;
  const points: EquityCurvePoint[] = [
    {
      at: sorted[0]?.createdAt ?? new Date().toISOString(),
      equityUsd: baseEquityUsd,
      cumulativePnlUsd: 0,
    },
  ];

  for (const trade of sorted) {
    cumulative += trade.realizedPnlUsd;
    points.push({
      at: trade.closedAt!,
      equityUsd: Number((baseEquityUsd + cumulative).toFixed(2)),
      cumulativePnlUsd: Number(cumulative.toFixed(2)),
    });
  }

  return points;
}

function computeMaxDrawdown(
  curve: EquityCurvePoint[],
): { pct: number; usd: number } {
  if (curve.length < 2) return { pct: 0, usd: 0 };
  let peak = curve[0].equityUsd;
  let maxDdUsd = 0;
  for (const point of curve) {
    if (point.equityUsd > peak) peak = point.equityUsd;
    const dd = peak - point.equityUsd;
    if (dd > maxDdUsd) maxDdUsd = dd;
  }
  const maxDdPct = peak > 0 ? (maxDdUsd / peak) * 100 : 0;
  return {
    pct: Number(maxDdPct.toFixed(2)),
    usd: Number(maxDdUsd.toFixed(2)),
  };
}

function pnlInWindow(
  closed: UnifiedPaperTrade[],
  windowMs: number,
): number {
  const cutoff = Date.now() - windowMs;
  return sum(
    closed
      .filter((t) => t.closedAt && new Date(t.closedAt).getTime() >= cutoff)
      .map((t) => t.realizedPnlUsd),
  );
}

export function computeUnifiedMetrics(
  positions: UnifiedPaperPosition[],
  baseEquityUsd: number = UNIFIED_PORTFOLIO_BASE_EQUITY_USD,
): UnifiedPortfolioMetrics {
  const open = positions.filter((p) => p.status === "OPEN");
  const closed = positions.filter(
    (p) => p.status === "CLOSED" || p.status === "CANCELLED",
  ) as UnifiedPaperTrade[];

  const realizedPnlUsd = sum(
    positions.map((p) => (p.status !== "OPEN" ? p.realizedPnlUsd : 0)),
  );
  const unrealizedPnlUsd = sum(open.map((p) => p.unrealizedPnlUsd));
  const totalPnlUsd = Number((realizedPnlUsd + unrealizedPnlUsd).toFixed(2));

  const openExposureUsd = sum(open.map((p) => p.notionalUsd));
  const closedWins = closed.filter((t) => (t.realizedPnlPct ?? 0) > 0);
  const closedLosses = closed.filter((t) => (t.realizedPnlPct ?? 0) < 0);

  const curve = buildEquityCurve(closed, baseEquityUsd);
  const drawdown = computeMaxDrawdown(curve);

  const avgWin =
    closedWins.length > 0
      ? sum(closedWins.map((t) => t.realizedPnlPct ?? 0)) / closedWins.length
      : 0;
  const avgLoss =
    closedLosses.length > 0
      ? sum(closedLosses.map((t) => t.realizedPnlPct ?? 0)) / closedLosses.length
      : 0;

  return {
    baseEquityUsd,
    totalEquity: Number((baseEquityUsd + totalPnlUsd).toFixed(2)),
    realizedPnlUsd,
    unrealizedPnlUsd,
    totalPnlUsd,
    realizedPnlPct: Number(
      ((realizedPnlUsd / baseEquityUsd) * 100).toFixed(2),
    ),
    unrealizedPnlPct: Number(
      ((unrealizedPnlUsd / baseEquityUsd) * 100).toFixed(2),
    ),
    totalPnlPct: Number(((totalPnlUsd / baseEquityUsd) * 100).toFixed(2)),
    openExposureUsd,
    openExposurePct: Number(
      ((openExposureUsd / baseEquityUsd) * 100).toFixed(2),
    ),
    exposureByAsset: groupExposure(open, (p) => p.symbol),
    exposureByStrategy: groupExposure(open, (p) => p.strategyName),
    winRate:
      closed.length > 0
        ? Number(((closedWins.length / closed.length) * 100).toFixed(1))
        : 0,
    averageWinPct: Number(avgWin.toFixed(2)),
    averageLossPct: Number(avgLoss.toFixed(2)),
    maxDrawdownPct: drawdown.pct,
    maxDrawdownUsd: drawdown.usd,
    dailyPnlUsd: pnlInWindow(closed, 24 * 60 * 60 * 1000),
    weeklyPnlUsd: pnlInWindow(closed, 7 * 24 * 60 * 60 * 1000),
    openCount: open.length,
    closedCount: closed.length,
    winCount: closedWins.length,
    lossCount: closedLosses.length,
  };
}

export function buildPnlByAsset(
  positions: UnifiedPaperPosition[],
): PnlSlice[] {
  return groupPnl(positions, (p) => p.symbol);
}

export function buildPnlByStrategy(
  positions: UnifiedPaperPosition[],
): PnlSlice[] {
  return groupPnl(positions, (p) => p.strategyName);
}
