import type { QuantBacktestMetrics, QuantBacktestTrade } from "@/lib/quant-backtest/types";
import type { TournamentContestantMeta, TournamentRankingMetrics } from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Number(value.toFixed(1))));
}

function stabilityScore(trades: QuantBacktestTrade[]): number {
  if (trades.length < 3) return 20;
  const pnls = trades.map((t) => t.netPnlPct);
  const mean = pnls.reduce((s, p) => s + p, 0) / pnls.length;
  const variance =
    pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / pnls.length;
  const std = Math.sqrt(variance);
  return clamp(100 - std * 8);
}

function scoreTradeFrequency(tradeCount: number, barsLoaded: number): number {
  if (tradeCount === 0) return 0;
  const per100 = (tradeCount / barsLoaded) * 100;
  if (per100 < 0.5) return 25;
  if (per100 < 1) return 50;
  if (per100 <= 4) return 90;
  if (per100 <= 8) return 70;
  return 40;
}

export function buildRankingMetrics(input: {
  metrics: QuantBacktestMetrics;
  trades: QuantBacktestTrade[];
  barsLoaded: number;
  meta: TournamentContestantMeta;
  peerReturns: number[];
  peerDrawdowns: number[];
}): TournamentRankingMetrics {
  const { metrics, trades, barsLoaded, meta, peerReturns, peerDrawdowns } = input;

  const bestReturn = Math.max(...peerReturns, 0.01);
  const worstReturn = Math.min(...peerReturns, -0.01);
  const returnNorm =
    ((metrics.totalReturnPct - worstReturn) / (bestReturn - worstReturn)) * 100;
  const netReturnScore = clamp(returnNorm);

  const maxDd = Math.max(...peerDrawdowns, 1);
  const maxDrawdownScore = clamp(
    100 - (metrics.maxDrawdownPct / maxDd) * 100,
  );

  const winRateScore = clamp(metrics.winRate);
  const profitFactorScore = clamp(
    metrics.profitFactor <= 0 ? 0 : Math.min(metrics.profitFactor / 2, 1) * 100,
  );
  const tradeFrequencyScore = scoreTradeFrequency(
    metrics.tradeCount,
    barsLoaded,
  );
  const stabilityScoreVal = stabilityScore(trades);

  const compositeScore = clamp(
    netReturnScore * 0.22 +
      maxDrawdownScore * 0.18 +
      winRateScore * 0.12 +
      profitFactorScore * 0.15 +
      tradeFrequencyScore * 0.08 +
      stabilityScoreVal * 0.1 +
      meta.simplicity * 0.05 +
      meta.executionRisk * 0.1,
  );

  return {
    netReturnScore,
    maxDrawdownScore,
    winRateScore,
    profitFactorScore,
    tradeFrequencyScore,
    stabilityScore: stabilityScoreVal,
    simplicityScore: meta.simplicity,
    executionRiskScore: meta.executionRisk,
    compositeScore,
  };
}

export function sortByComposite(
  entries: Array<{ ranking: TournamentRankingMetrics }>,
): number[] {
  return [...entries.keys()].sort(
    (a, b) =>
      entries[b].ranking.compositeScore - entries[a].ranking.compositeScore,
  );
}
