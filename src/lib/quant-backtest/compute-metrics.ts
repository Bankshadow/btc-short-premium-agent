import type {
  QuantBacktestMetrics,
  QuantBacktestTrade,
  QuantEquityPoint,
  QuantLiquidityWarning,
  QuantRegimeBreakdown,
} from "./types";
import type { Candle } from "@/lib/indicators/technical";

export function buildQuantEquityCurve(trades: QuantBacktestTrade[]): QuantEquityPoint[] {
  let equity = 0;
  let peak = 0;
  const curve: QuantEquityPoint[] = [];

  for (const trade of trades) {
    equity += trade.netPnlPct;
    if (equity > peak) peak = equity;
    const drawdownPct =
      peak > 0 ? Number((((peak - equity) / Math.max(peak, 1)) * 100).toFixed(2)) : 0;
    curve.push({
      timestamp: trade.exitTime,
      equityPct: Number(equity.toFixed(2)),
      drawdownPct,
    });
  }

  return curve;
}

export function computeQuantMetrics(trades: QuantBacktestTrade[]): QuantBacktestMetrics {
  const pnls = trades.map((t) => t.netPnlPct);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const totalReturnPct = Number(pnls.reduce((s, p) => s + p, 0).toFixed(2));
  const curve = buildQuantEquityCurve(trades);
  const maxDrawdownPct =
    curve.length > 0 ? Math.max(...curve.map((c) => c.drawdownPct)) : 0;
  const winRate =
    pnls.length > 0 ? Math.round((wins.length / pnls.length) * 100) : 0;
  const averageWinPct =
    wins.length > 0
      ? Number((wins.reduce((s, p) => s + p, 0) / wins.length).toFixed(2))
      : 0;
  const averageLossPct =
    losses.length > 0
      ? Number((losses.reduce((s, p) => s + p, 0) / losses.length).toFixed(2))
      : 0;
  const grossWins = wins.reduce((s, p) => s + p, 0);
  const grossLosses = Math.abs(losses.reduce((s, p) => s + p, 0));
  const profitFactor =
    grossLosses > 0
      ? Number((grossWins / grossLosses).toFixed(2))
      : grossWins > 0
        ? 99
        : 0;
  const expectancyPct =
    pnls.length > 0
      ? Number((totalReturnPct / pnls.length).toFixed(2))
      : 0;

  return {
    totalReturnPct,
    winRate,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    profitFactor,
    averageWinPct,
    averageLossPct,
    tradeCount: trades.length,
    expectancyPct,
  };
}

export function buildRegimeBreakdown(trades: QuantBacktestTrade[]): QuantRegimeBreakdown[] {
  const regimes: Array<"bullish" | "bearish" | "neutral"> = [
    "bullish",
    "bearish",
    "neutral",
  ];
  return regimes.map((regime) => {
    const subset = trades.filter((t) => t.regime === regime);
    const pnls = subset.map((t) => t.netPnlPct);
    const wins = pnls.filter((p) => p > 0).length;
    return {
      regime,
      tradeCount: subset.length,
      winRate:
        subset.length > 0 ? Math.round((wins / subset.length) * 100) : 0,
      netReturnPct: Number(pnls.reduce((s, p) => s + p, 0).toFixed(2)),
    };
  });
}

export function assessLiquidity(
  candles: Candle[],
  symbol: string,
): QuantLiquidityWarning {
  if (candles.length === 0) {
    return {
      level: "VERY_LOW",
      message: "No candle data — liquidity unknown.",
      avgBarVolume: 0,
    };
  }
  const avgBarVolume =
    candles.reduce((s, c) => s + c.volume, 0) / candles.length;
  const threshold =
    symbol === "BTCUSDT" ? 500 : 50_000;

  if (avgBarVolume < threshold * 0.25) {
    return {
      level: "VERY_LOW",
      message: `Very low ${symbol} bar volume — slippage assumptions may understate real costs.`,
      avgBarVolume: Number(avgBarVolume.toFixed(2)),
    };
  }
  if (avgBarVolume < threshold) {
    return {
      level: "LOW",
      message: `Below-average ${symbol} liquidity for this window — widen slippage in stress tests.`,
      avgBarVolume: Number(avgBarVolume.toFixed(2)),
    };
  }
  return {
    level: "OK",
    message: "Liquidity adequate for backtest assumptions on major perp.",
    avgBarVolume: Number(avgBarVolume.toFixed(2)),
  };
}
