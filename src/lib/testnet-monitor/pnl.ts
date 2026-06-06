import type {
  TestnetClosedTrade,
  TestnetDailyPnlPoint,
  TestnetPosition,
  TestnetPositionSide,
  TestnetPnlByGroup,
  TestnetTradeResult,
} from "./types";

export function calculateUnrealizedPnl(position: {
  side: TestnetPositionSide;
  qty: number;
  entryPrice: number;
  markPrice: number;
}): number {
  const diff =
    position.side === "LONG"
      ? position.markPrice - position.entryPrice
      : position.entryPrice - position.markPrice;
  return diff * Math.abs(position.qty);
}

export function calculateUnrealizedPnlPct(
  unrealizedPnl: number,
  notionalUsd: number,
): number {
  if (!notionalUsd || notionalUsd === 0) return 0;
  return (unrealizedPnl / notionalUsd) * 100;
}

export function calculateClosedTradePnl(input: {
  entry: number;
  exit: number;
  side: TestnetPositionSide;
  qty: number;
  fees?: number;
}): { grossPnl: number; netPnl: number; fee: number } {
  const gross =
    input.side === "LONG"
      ? (input.exit - input.entry) * input.qty
      : (input.entry - input.exit) * input.qty;
  const fee = input.fees ?? 0;
  return { grossPnl: gross, netPnl: gross - fee, fee };
}

export function classifyTradeResult(netPnl: number): TestnetTradeResult {
  if (Math.abs(netPnl) < 0.01) return "BREAKEVEN";
  return netPnl > 0 ? "WIN" : "LOSS";
}

export function calculateWinRate(closedTrades: TestnetClosedTrade[]): number {
  if (closedTrades.length === 0) return 0;
  const wins = closedTrades.filter((t) => t.result === "WIN").length;
  return (wins / closedTrades.length) * 100;
}

export function calculateDailyPnl(
  closedTrades: TestnetClosedTrade[],
): TestnetDailyPnlPoint[] {
  const byDay = new Map<string, { netPnl: number; tradeCount: number }>();
  for (const trade of closedTrades) {
    const day = trade.closedAt.slice(0, 10);
    const prev = byDay.get(day) ?? { netPnl: 0, tradeCount: 0 };
    byDay.set(day, {
      netPnl: prev.netPnl + trade.netPnl,
      tradeCount: prev.tradeCount + 1,
    });
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}

export function calculateMaxDrawdown(
  equitySeries: Array<{ timestamp: string; equity: number }>,
): number {
  let peak = 0;
  let maxDd = 0;
  for (const point of equitySeries) {
    if (point.equity > peak) peak = point.equity;
    maxDd = Math.max(maxDd, peak - point.equity);
  }
  return maxDd;
}

export function buildEquitySeries(
  closedTrades: TestnetClosedTrade[],
  openPositions: TestnetPosition[],
): Array<{ timestamp: string; equity: number }> {
  const sorted = [...closedTrades].sort((a, b) =>
    a.closedAt.localeCompare(b.closedAt),
  );
  let equity = 0;
  const series: Array<{ timestamp: string; equity: number }> = [];
  for (const trade of sorted) {
    equity += trade.netPnl;
    series.push({ timestamp: trade.closedAt, equity });
  }
  if (openPositions.length > 0) {
    const unrealized = openPositions.reduce((s, p) => s + p.unrealizedPnl, 0);
    series.push({
      timestamp: new Date().toISOString(),
      equity: equity + unrealized,
    });
  }
  return series;
}

export function groupPnlBySymbol(
  closedTrades: TestnetClosedTrade[],
): TestnetPnlByGroup[] {
  const map = new Map<string, TestnetClosedTrade[]>();
  for (const t of closedTrades) {
    const list = map.get(t.symbol) ?? [];
    list.push(t);
    map.set(t.symbol, list);
  }
  return [...map.entries()].map(([label, trades]) => ({
    label,
    netPnl: trades.reduce((s, t) => s + t.netPnl, 0),
    tradeCount: trades.length,
    winRate: calculateWinRate(trades),
  }));
}

export function groupPnlByStrategy(
  closedTrades: TestnetClosedTrade[],
): TestnetPnlByGroup[] {
  const map = new Map<string, TestnetClosedTrade[]>();
  for (const t of closedTrades) {
    const label = t.strategy ?? "unknown";
    const list = map.get(label) ?? [];
    list.push(t);
    map.set(label, list);
  }
  return [...map.entries()].map(([label, trades]) => ({
    label,
    netPnl: trades.reduce((s, t) => s + t.netPnl, 0),
    tradeCount: trades.length,
    winRate: calculateWinRate(trades),
  }));
}

export function sumUnrealizedPnl(positions: TestnetPosition[]): number {
  return positions.reduce((s, p) => s + p.unrealizedPnl, 0);
}

export function sumRealizedPnl(closedTrades: TestnetClosedTrade[]): number {
  return closedTrades.reduce((s, t) => s + t.netPnl, 0);
}

export function dailyTradeCount(closedTrades: TestnetClosedTrade[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return closedTrades.filter((t) => t.closedAt.startsWith(today)).length;
}
