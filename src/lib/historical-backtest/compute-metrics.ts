import type {
  BacktestMetrics,
  BacktestTrade,
  EquityCurvePoint,
} from "./types";

export function buildEquityCurve(trades: BacktestTrade[]): EquityCurvePoint[] {
  let equity = 0;
  let peak = 0;
  const curve: EquityCurvePoint[] = [];

  for (const trade of trades) {
    if (trade.simulatedVerdict !== "TRADE" || trade.pnlPct == null) continue;
    equity += trade.pnlPct;
    if (equity > peak) peak = equity;
    const drawdownPct = peak > 0 ? Number(((peak - equity) / peak) * 100) : 0;
    curve.push({
      timestamp: trade.timestamp,
      equityPct: Number(equity.toFixed(2)),
      drawdownPct: Number(drawdownPct.toFixed(2)),
    });
  }

  return curve;
}

export function computeBacktestMetrics(
  trades: BacktestTrade[],
  sessionsReplayed: number,
): BacktestMetrics {
  const simulatedTrades = trades.filter((t) => t.simulatedVerdict === "TRADE");
  const pnls = simulatedTrades
    .map((t) => t.pnlPct)
    .filter((p): p is number => p != null);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);

  const totalReturnPct = Number(pnls.reduce((s, p) => s + p, 0).toFixed(2));
  const curve = buildEquityCurve(trades);
  const maxDrawdownPct =
    curve.length > 0
      ? Math.max(...curve.map((c) => c.drawdownPct))
      : 0;

  const winRate =
    pnls.length > 0
      ? Math.round((wins.length / pnls.length) * 100)
      : 0;
  const averageWinPct =
    wins.length > 0
      ? Number((wins.reduce((s, p) => s + p, 0) / wins.length).toFixed(2))
      : 0;
  const averageLossPct =
    losses.length > 0
      ? Number((losses.reduce((s, p) => s + p, 0) / losses.length).toFixed(2))
      : 0;

  const expectancy =
    pnls.length > 0
      ? Number((totalReturnPct / pnls.length).toFixed(2))
      : 0;

  let longestLossStreak = 0;
  let currentStreak = 0;
  for (const p of pnls) {
    if (p < 0) {
      currentStreak += 1;
      longestLossStreak = Math.max(longestLossStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  const vetoBlocked = trades.filter(
    (t) => t.riskVetoBlocked && t.loggedVerdict === "TRADE",
  );
  const pnlSavedPct = vetoBlocked.reduce((s, t) => {
    if (t.pnlPct != null && t.pnlPct < 0) return s + Math.abs(t.pnlPct);
    return s;
  }, 0);

  const aligned = trades.filter((t) => t.aligned).length;

  return {
    totalReturnPct,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    winRate,
    averageWinPct,
    averageLossPct,
    expectancy,
    tradeFrequency: simulatedTrades.length,
    longestLossStreak,
    missedOpportunityCount: trades.filter((t) => t.missedOpportunity).length,
    falseTradeCount: trades.filter((t) => t.falseTrade).length,
    falseSkipCount: trades.filter((t) => t.falseSkip).length,
    riskVetoImpact: {
      vetoCount: trades.filter((t) => t.simulatedRiskVeto).length,
      tradesBlocked: vetoBlocked.length,
      pnlSavedPct: Number(pnlSavedPct.toFixed(2)),
    },
    sessionsReplayed,
    alignmentRate:
      trades.length > 0 ? Math.round((aligned / trades.length) * 100) : 0,
  };
}
