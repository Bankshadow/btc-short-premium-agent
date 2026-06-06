import { fetchQuantBacktestCandles } from "@/lib/quant-backtest/fetch-klines";
import { DEFAULT_QUANT_FRICTION } from "@/lib/quant-backtest/friction";
import {
  assessLiquidity,
  buildQuantEquityCurve,
  computeQuantMetrics,
} from "@/lib/quant-backtest/compute-metrics";
import { generateSignalSeries } from "@/lib/quant-backtest/signal-runners";
import { simulateQuantTrades } from "@/lib/quant-backtest/simulate-trades";
import { TOURNAMENT_CONTESTANTS } from "./contestants";
import { classifyTournamentStrategy } from "./classify-strategy";
import { buildRankingMetrics, sortByComposite } from "./score-ranking";
import type { TournamentEntry, TournamentInput, TournamentResult } from "./types";

function newTournamentId(): string {
  return `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function runStrategyTournament(
  input: TournamentInput,
): Promise<TournamentResult> {
  const friction = input.friction ?? DEFAULT_QUANT_FRICTION;
  const candles = await fetchQuantBacktestCandles({
    symbol: input.symbol,
    timeframe: input.timeframe,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  if (candles.length < 30) {
    throw new Error(
      `Insufficient kline data (${candles.length} bars). Widen date range.`,
    );
  }

  const liquidityWarning = assessLiquidity(candles, input.symbol);
  const rawEntries: Array<{
    sourceId: string;
    strategyName: string;
    metrics: ReturnType<typeof computeQuantMetrics>;
    trades: ReturnType<typeof simulateQuantTrades>;
    equityCurve: ReturnType<typeof buildQuantEquityCurve>;
    meta: (typeof TOURNAMENT_CONTESTANTS)[number];
  }> = [];

  for (const meta of TOURNAMENT_CONTESTANTS) {
    const signals = generateSignalSeries(meta.sourceId, candles);
    const trades = simulateQuantTrades({ candles, signals, friction });
    const metrics = computeQuantMetrics(trades);
    rawEntries.push({
      sourceId: meta.sourceId,
      strategyName: meta.strategyName,
      metrics,
      trades,
      equityCurve: buildQuantEquityCurve(trades),
      meta,
    });
  }

  const peerReturns = rawEntries.map((e) => e.metrics.totalReturnPct);
  const peerDrawdowns = rawEntries.map((e) => e.metrics.maxDrawdownPct);

  const withRanking = rawEntries.map((entry) => ({
    ...entry,
    ranking: buildRankingMetrics({
      metrics: entry.metrics,
      trades: entry.trades,
      barsLoaded: candles.length,
      meta: entry.meta,
      peerReturns,
      peerDrawdowns,
    }),
  }));

  const order = sortByComposite(withRanking);
  const entries: TournamentEntry[] = order.map((idx, position) => {
    const entry = withRanking[idx];
    const rank = position + 1;
    const classified = classifyTournamentStrategy({
      metrics: entry.metrics,
      ranking: entry.ranking,
      meta: entry.meta,
      rank,
      barsLoaded: candles.length,
      totalContestants: TOURNAMENT_CONTESTANTS.length,
    });

    return {
      sourceId: entry.sourceId,
      strategyName: entry.strategyName,
      rank,
      metrics: entry.metrics,
      ranking: entry.ranking,
      classification: classified.classification,
      classificationSummary: classified.summary,
      rejectionReasons: classified.rejectionReasons,
      tradeFrequencyPer100Bars: Number(
        ((entry.metrics.tradeCount / candles.length) * 100).toFixed(2),
      ),
      equityCurve: entry.equityCurve,
    };
  });

  const winner = entries.find((e) => e.rank === 1) ?? null;

  return {
    tournamentId: newTournamentId(),
    symbol: input.symbol,
    timeframe: input.timeframe,
    startDate: input.startDate,
    endDate: input.endDate,
    barsLoaded: candles.length,
    friction,
    liquidityWarning,
    entries,
    winner,
    simulationOnly: true,
    cannotCreateOrders: true,
    cannotPromoteTestnetWithoutApproval: true,
    completedAt: new Date().toISOString(),
  };
}
