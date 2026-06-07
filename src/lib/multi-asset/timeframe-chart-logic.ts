import {
  atr,
  detectTrendFromDaily,
  ema,
  macd,
  type Candle,
} from "@/lib/indicators/technical";
import type { TechnicalSnapshot } from "@/lib/types/market";
import type { PerpAssetConfig } from "./asset-config";
import type { PerpTickerSnapshot } from "@/lib/bybit/perp-market";
import type { PerpDirection, SignalConfidence } from "./types";
import type { TimeframeChartSignal, TimeframeHorizon } from "./timeframe-types";

export const TIMEFRAME_HORIZON_CONFIG: Record<
  TimeframeHorizon,
  {
    label: string;
    actionableScore: number;
    atrStopMult: number;
    atrTpMult: number;
    minCandles: number;
  }
> = {
  SHORT: {
    label: "1H scalp",
    actionableScore: 28,
    atrStopMult: 1.2,
    atrTpMult: 2,
    minCandles: 50,
  },
  MEDIUM: {
    label: "4H swing",
    actionableScore: 30,
    atrStopMult: 1.5,
    atrTpMult: 2.5,
    minCandles: 50,
  },
  LONG: {
    label: "1D position",
    actionableScore: 35,
    atrStopMult: 2,
    atrTpMult: 3.5,
    minCandles: 50,
  },
};

function computeRsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - 100 / (1 + rs));
}

function clampScore(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

function confidenceFromScore(
  score: number,
  actionableScore: number,
): SignalConfidence {
  const abs = Math.abs(score);
  if (abs >= actionableScore + 25) return "HIGH";
  if (abs >= actionableScore) return "MEDIUM";
  return "LOW";
}

function scoreTrendMomentum(input: {
  trend: "bullish" | "bearish" | "neutral";
  macdHistogram: number;
  ema20: number | null;
  ema50: number | null;
  rsi14: number;
  trendWeight: number;
}): { score: number; reasons: string[]; risks: string[] } {
  const reasons: string[] = [];
  const risks: string[] = [];
  let score = 0;

  if (input.trend === "bullish") {
    score += input.trendWeight;
    reasons.push("Trend bullish (EMA stack + MACD)");
  } else if (input.trend === "bearish") {
    score -= input.trendWeight;
    reasons.push("Trend bearish (EMA stack + MACD)");
  } else {
    reasons.push("Trend neutral — waiting for bias");
  }

  if (input.macdHistogram > 0) score += 12;
  else if (input.macdHistogram < 0) score -= 12;

  if (input.ema20 !== null && input.ema50 !== null) {
    if (input.ema20 > input.ema50) score += 10;
    else if (input.ema20 < input.ema50) score -= 10;
  }

  if (input.rsi14 >= 70) {
    score -= 8;
    risks.push(`RSI overbought (${input.rsi14})`);
  } else if (input.rsi14 <= 30) {
    score += 8;
    risks.push(`RSI oversold (${input.rsi14})`);
  }

  return { score, reasons, risks };
}

function resolveDirection(
  score: number,
  actionableScore: number,
): PerpDirection {
  if (score >= actionableScore) return "LONG";
  if (score <= -actionableScore) return "SHORT";
  return "FLAT";
}

function resolveStops(input: {
  direction: Exclude<PerpDirection, "FLAT">;
  lastClose: number;
  atrValue: number;
  horizon: TimeframeHorizon;
}): { stopLoss: number | null; takeProfit: number | null } {
  const cfg = TIMEFRAME_HORIZON_CONFIG[input.horizon];
  if (input.atrValue <= 0) {
    return { stopLoss: null, takeProfit: null };
  }
  const stopDist = input.atrValue * cfg.atrStopMult;
  const tpDist = input.atrValue * cfg.atrTpMult;
  if (input.direction === "LONG") {
    return {
      stopLoss: Number((input.lastClose - stopDist).toFixed(4)),
      takeProfit: Number((input.lastClose + tpDist).toFixed(4)),
    };
  }
  return {
    stopLoss: Number((input.lastClose + stopDist).toFixed(4)),
    takeProfit: Number((input.lastClose - tpDist).toFixed(4)),
  };
}

export function runTimeframeChartFromCandles(input: {
  asset: PerpAssetConfig;
  ticker: PerpTickerSnapshot;
  candles: Candle[];
  horizon: TimeframeHorizon;
  fundingRatePct?: number | null;
}): TimeframeChartSignal {
  const cfg = TIMEFRAME_HORIZON_CONFIG[input.horizon];
  const closes = input.candles.map((c) => c.close);
  const trend = detectTrendFromDaily(input.candles);
  const rsi14 = computeRsi(closes);
  const macdResult = macd(closes);
  const macdHistogram = macdResult?.histogram ?? 0;
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const atrValue = atr(input.candles, 14) ?? 0;
  const lastClose = closes.at(-1) ?? input.ticker.price;

  const trendWeight =
    input.horizon === "SHORT" ? 28 : input.horizon === "MEDIUM" ? 32 : 35;
  const { score: baseScore, reasons, risks } = scoreTrendMomentum({
    trend,
    macdHistogram,
    ema20,
    ema50,
    rsi14,
    trendWeight,
  });

  let score = baseScore;
  if (input.ticker.priceChange24hPct > 3) score += 6;
  else if (input.ticker.priceChange24hPct < -3) score -= 6;

  const funding = input.fundingRatePct ?? input.ticker.fundingRatePct;
  if (funding !== null && funding !== undefined) {
    if (funding > 0.03) {
      score -= 5;
      risks.push(`Positive funding (${funding.toFixed(4)}%) — longs crowded`);
    } else if (funding < -0.03) {
      score += 5;
      risks.push(`Negative funding (${funding.toFixed(4)}%) — shorts crowded`);
    }
  }

  score = clampScore(score);
  const dataFresh =
    input.candles.length >= cfg.minCandles && input.ticker.price > 0;
  if (!dataFresh) {
    risks.push("Insufficient candle history for this timeframe");
  }

  const direction = resolveDirection(score, cfg.actionableScore);
  const confidence = confidenceFromScore(score, cfg.actionableScore);
  const actionable = direction !== "FLAT" && dataFresh;

  let stopLoss: number | null = null;
  let takeProfit: number | null = null;
  if (actionable) {
    const stops = resolveStops({
      direction,
      lastClose,
      atrValue,
      horizon: input.horizon,
    });
    stopLoss = stops.stopLoss;
    takeProfit = stops.takeProfit;
  }

  reasons.unshift(`${cfg.label} chart read`);

  return {
    assetId: input.asset.id,
    symbol: input.asset.symbol,
    label: input.asset.label,
    horizon: input.horizon,
    horizonLabel: cfg.label,
    price: input.ticker.price,
    trend,
    rsi14,
    macdHistogram,
    atr: atrValue,
    score,
    direction,
    confidence,
    actionable,
    stopLoss,
    takeProfit,
    reasons,
    risks,
    dataFresh,
  };
}

/** Desk agents use pre-built technical snapshots (BTC primary tape). */
export function scoreTechnicalSnapshotForHorizon(
  snapshot: TechnicalSnapshot,
  horizon: TimeframeHorizon,
): {
  score: number;
  direction: PerpDirection;
  confidence: SignalConfidence;
  recommendationScore: number;
} {
  const cfg = TIMEFRAME_HORIZON_CONFIG[horizon];
  const trendWeight =
    horizon === "SHORT" ? 28 : horizon === "MEDIUM" ? 32 : 35;
  const { score: baseScore } = scoreTrendMomentum({
    trend: snapshot.trend,
    macdHistogram: snapshot.macdHistogram,
    ema20: snapshot.ema20,
    ema50: snapshot.ema50,
    rsi14: snapshot.rsi14,
    trendWeight,
  });

  let score = baseScore;
  if (snapshot.rsi14 >= 75) score -= 5;
  else if (snapshot.rsi14 <= 25) score += 5;

  score = clampScore(score);
  const direction = resolveDirection(score, cfg.actionableScore);
  const confidence = confidenceFromScore(score, cfg.actionableScore);
  const recommendationScore = 50 + Math.round(score / 2);

  return { score, direction, confidence, recommendationScore };
}
