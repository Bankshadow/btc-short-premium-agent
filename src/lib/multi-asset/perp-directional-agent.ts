import {
  atr,
  detectTrendFromDaily,
  ema,
  macd,
  type Candle,
} from "@/lib/indicators/technical";
import type { PerpAssetConfig } from "./asset-config";
import type { PerpTickerSnapshot } from "@/lib/bybit/perp-market";
import type {
  PerpDirection,
  PerpDirectionalSignal,
  SignalConfidence,
} from "./types";

const ACTIONABLE_SCORE = 35;
const MAX_SIZE_PCT = 2;

/** Wilder's RSI on close prices. Returns 50 when insufficient data. */
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

function confidenceFromScore(score: number): SignalConfidence {
  const abs = Math.abs(score);
  if (abs >= 60) return "HIGH";
  if (abs >= ACTIONABLE_SCORE) return "MEDIUM";
  return "LOW";
}

interface DirectionalInput {
  asset: PerpAssetConfig;
  ticker: PerpTickerSnapshot;
  dailyCandles: Candle[];
  h4Candles: Candle[];
}

/**
 * Perp directional read for a single asset. Produces a LONG/SHORT/FLAT bias
 * with conviction score from trend, momentum (MACD/RSI) and funding.
 * Analysis-only — never places live orders.
 */
export function runPerpDirectionalAgent(
  input: DirectionalInput,
): PerpDirectionalSignal {
  const { asset, ticker, dailyCandles, h4Candles } = input;
  const closes = dailyCandles.map((c) => c.close);

  const trend = detectTrendFromDaily(dailyCandles);
  const rsi14 = computeRsi(closes);
  const macdResult = macd(closes);
  const macdHistogram = macdResult?.histogram ?? 0;
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const atrValue = atr(h4Candles.length > 0 ? h4Candles : dailyCandles, 14) ?? 0;
  const lastClose = closes.at(-1) ?? ticker.price;

  const reasons: string[] = [];
  const risks: string[] = [];
  let score = 0;

  if (trend === "bullish") {
    score += 35;
    reasons.push("Daily trend bullish (EMA stack + MACD up)");
  } else if (trend === "bearish") {
    score -= 35;
    reasons.push("Daily trend bearish (EMA stack + MACD down)");
  } else {
    reasons.push("Daily trend neutral");
  }

  if (macdHistogram > 0) score += 12;
  else if (macdHistogram < 0) score -= 12;

  if (ema20 !== null && ema50 !== null) {
    if (ema20 > ema50) score += 10;
    else if (ema20 < ema50) score -= 10;
  }

  if (rsi14 >= 70) {
    score -= 8;
    risks.push(`RSI overbought (${rsi14}) — long entries crowded`);
  } else if (rsi14 <= 30) {
    score += 8;
    risks.push(`RSI oversold (${rsi14}) — short entries crowded`);
  }

  if (ticker.priceChange24hPct > 3) score += 8;
  else if (ticker.priceChange24hPct < -3) score -= 8;

  const funding = ticker.fundingRatePct;
  if (funding !== null) {
    if (funding > 0.03) {
      score -= 6;
      risks.push(
        `High positive funding (${funding.toFixed(4)}%) — longs pay, crowded long`,
      );
    } else if (funding < -0.03) {
      score += 6;
      risks.push(
        `Negative funding (${funding.toFixed(4)}%) — shorts pay, crowded short`,
      );
    }
  }

  score = clampScore(score);

  const dataFresh = dailyCandles.length >= 50 && ticker.price > 0;
  if (!dataFresh) {
    risks.push("Insufficient history / stale data — paper-only, no auto-open");
  }

  let direction: PerpDirection = "FLAT";
  if (score >= ACTIONABLE_SCORE) direction = "LONG";
  else if (score <= -ACTIONABLE_SCORE) direction = "SHORT";

  const confidence = confidenceFromScore(score);
  const actionable = direction !== "FLAT" && dataFresh;

  const suggestedSizePct = actionable
    ? Number(
        (
          MAX_SIZE_PCT *
          (confidence === "HIGH" ? 1 : confidence === "MEDIUM" ? 0.6 : 0.3)
        ).toFixed(2),
      )
    : 0;

  let stopLoss: number | null = null;
  let takeProfit: number | null = null;
  if (actionable && atrValue > 0) {
    const stopDist = atrValue * 1.5;
    const tpDist = atrValue * 2.5;
    if (direction === "LONG") {
      stopLoss = Number((lastClose - stopDist).toFixed(4));
      takeProfit = Number((lastClose + tpDist).toFixed(4));
    } else {
      stopLoss = Number((lastClose + stopDist).toFixed(4));
      takeProfit = Number((lastClose - tpDist).toFixed(4));
    }
  }

  if (!asset.hasOptions) {
    reasons.push("No options market — perp directional only");
  }

  return {
    assetId: asset.id,
    symbol: asset.symbol,
    label: asset.label,
    hasOptions: asset.hasOptions,
    price: ticker.price,
    priceChange24hPct: Number(ticker.priceChange24hPct.toFixed(2)),
    fundingRatePct: funding,
    trend,
    rsi14,
    macdHistogram,
    atr: atrValue,
    score,
    direction,
    confidence,
    actionable,
    suggestedSizePct,
    stopLoss,
    takeProfit,
    reasons,
    risks,
    dataFresh,
  };
}
