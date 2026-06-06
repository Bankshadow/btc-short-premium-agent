import { getSeedById } from "@/lib/quant-strategy-importer/build-catalog";
import { fetchQuantBacktestCandles } from "./fetch-klines";
import { DEFAULT_QUANT_FRICTION, totalFrictionApplied as frictionTotal } from "./friction";
import {
  assessLiquidity,
  buildRegimeBreakdown,
  buildQuantEquityCurve,
  computeQuantMetrics,
} from "./compute-metrics";
import { buildAiPaperRecommendation } from "./build-ai-recommendation";
import {
  generateSignalSeries,
  isQuantBacktestRunnerSupported,
} from "./signal-runners";
import { simulateQuantTrades } from "./simulate-trades";
import type { QuantBacktestInput, QuantBacktestResult } from "./types";

function newRunId(): string {
  return `qbt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function runQuantBacktest(
  input: QuantBacktestInput,
): Promise<QuantBacktestResult> {
  const seed = getSeedById(input.sourceId);
  if (!seed) {
    throw new Error(`Unknown quant strategy sourceId: ${input.sourceId}`);
  }
  if (!isQuantBacktestRunnerSupported(input.sourceId)) {
    throw new Error(
      `Backtest runner not implemented for ${seed.strategyName}. Supported: MACD, RSI, Bollinger, Dual Thrust, Heikin-Ashi.`,
    );
  }

  const friction = input.friction ?? DEFAULT_QUANT_FRICTION;
  const candles = await fetchQuantBacktestCandles({
    symbol: input.symbol,
    timeframe: input.timeframe,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  if (candles.length < 30) {
    throw new Error(
      `Insufficient kline data (${candles.length} bars). Widen date range or change timeframe.`,
    );
  }

  const signals = generateSignalSeries(
    input.sourceId,
    candles,
    input.parameters,
  );
  const trades = simulateQuantTrades({
    candles,
    signals,
    friction,
    parameters: input.parameters,
  });
  const metrics = computeQuantMetrics(trades);
  const equityCurve = buildQuantEquityCurve(trades);
  const regimeBreakdown = buildRegimeBreakdown(trades);
  const liquidityWarning = assessLiquidity(candles, input.symbol);
  const aiRecommendation = buildAiPaperRecommendation({
    metrics,
    liquidity: liquidityWarning,
    strategyName: seed.strategyName,
    symbol: input.symbol,
    barsLoaded: candles.length,
  });

  return {
    runId: newRunId(),
    sourceId: input.sourceId,
    strategyName: seed.strategyName,
    symbol: input.symbol,
    timeframe: input.timeframe,
    startDate: input.startDate,
    endDate: input.endDate,
    barsLoaded: candles.length,
    friction,
    frictionTotalPct: frictionTotal(trades.length, friction),
    liquidityWarning,
    metrics,
    trades,
    equityCurve,
    regimeBreakdown,
    aiRecommendation,
    simulationOnly: true,
    cannotCreateOrders: true,
    cannotPromoteTestnetWithoutApproval: true,
    completedAt: new Date().toISOString(),
  };
}
