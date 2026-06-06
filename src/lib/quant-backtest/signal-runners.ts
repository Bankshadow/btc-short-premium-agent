import {
  bollingerBands,
  detectTrendFromDaily,
  heikinAshi,
  macd,
  rsi,
  type Candle,
} from "@/lib/indicators/technical";
import type { QuantSignalDirection, QuantStrategyParameters } from "./types";

export type SignalSeries = QuantSignalDirection[];

const SUPPORTED_RUNNERS = new Set([
  "macd-oscillator",
  "rsi-pattern-recognition",
  "bollinger-bands-pattern",
  "dual-thrust",
  "heikin-ashi",
  "ai-desk-options-premium",
]);

export function isQuantBacktestRunnerSupported(sourceId: string): boolean {
  return SUPPORTED_RUNNERS.has(sourceId);
}

function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}

function emptySignals(length: number): SignalSeries {
  return Array.from({ length }, () => "FLAT" as const);
}

export function generateSignalSeries(
  sourceId: string,
  candles: Candle[],
  params: QuantStrategyParameters = {},
): SignalSeries {
  if (candles.length < 30) return emptySignals(candles.length);

  switch (sourceId) {
    case "macd-oscillator":
      return macdSignals(candles);
    case "rsi-pattern-recognition":
      return rsiSignals(candles, params);
    case "bollinger-bands-pattern":
      return bollingerSignals(candles, params);
    case "dual-thrust":
      return dualThrustSignals(candles, params);
    case "heikin-ashi":
      return heikinAshiSignals(candles);
    case "ai-desk-options-premium":
      return aiDeskSignals(candles);
    default:
      return emptySignals(candles.length);
  }
}

function macdSignals(candles: Candle[]): SignalSeries {
  const signals = emptySignals(candles.length);
  const prices = closes(candles);
  let prevHist: number | null = null;

  for (let i = 26; i < candles.length; i += 1) {
    const slice = prices.slice(0, i + 1);
    const result = macd(slice);
    if (!result) continue;
    if (prevHist !== null) {
      if (prevHist <= 0 && result.histogram > 0) signals[i] = "LONG";
      else if (prevHist >= 0 && result.histogram < 0) signals[i] = "SHORT";
    }
    prevHist = result.histogram;
  }
  return signals;
}

function rsiSignals(candles: Candle[], params: QuantStrategyParameters): SignalSeries {
  const signals = emptySignals(candles.length);
  const period = params.rsiPeriod ?? 14;
  const oversold = params.rsiOversold ?? 30;
  const overbought = params.rsiOverbought ?? 70;
  const prices = closes(candles);
  let prevRsi: number | null = null;

  for (let i = period + 1; i < candles.length; i += 1) {
    const value = rsi(prices.slice(0, i + 1), period);
    if (value === null || prevRsi === null) {
      prevRsi = value;
      continue;
    }
    if (prevRsi < oversold && value >= oversold) signals[i] = "LONG";
    else if (prevRsi > overbought && value <= overbought) signals[i] = "SHORT";
    prevRsi = value;
  }
  return signals;
}

function bollingerSignals(
  candles: Candle[],
  params: QuantStrategyParameters,
): SignalSeries {
  const signals = emptySignals(candles.length);
  const period = params.bbPeriod ?? 20;
  const stdDev = params.bbStdDev ?? 2;
  const prices = closes(candles);

  for (let i = period; i < candles.length; i += 1) {
    const bands = bollingerBands(prices.slice(0, i + 1), period, stdDev);
    if (!bands) continue;
    const prevClose = candles[i - 1].close;
    const close = candles[i].close;
    if (prevClose <= bands.lower && close > prevClose) signals[i] = "LONG";
    else if (prevClose >= bands.upper && close < prevClose) signals[i] = "SHORT";
  }
  return signals;
}

function dualThrustSignals(
  candles: Candle[],
  params: QuantStrategyParameters,
): SignalSeries {
  const signals = emptySignals(candles.length);
  const lookback = params.dualThrustLookback ?? 4;
  const k = params.dualThrustK ?? 0.5;

  for (let i = lookback; i < candles.length; i += 1) {
    const window = candles.slice(i - lookback, i);
    const hh = Math.max(...window.map((c) => c.high));
    const hc = Math.max(...window.map((c) => c.close));
    const ll = Math.min(...window.map((c) => c.low));
    const lc = Math.min(...window.map((c) => c.close));
    const range = Math.max(hh - lc, hc - ll);
    const open = candles[i].open;
    const upper = open + range * k;
    const lower = open - range * k;
    const close = candles[i].close;
    if (close > upper) signals[i] = "LONG";
    else if (close < lower) signals[i] = "SHORT";
  }
  return signals;
}

function heikinAshiSignals(candles: Candle[]): SignalSeries {
  const signals = emptySignals(candles.length);
  const ha = heikinAshi(candles);
  for (let i = 1; i < ha.length; i += 1) {
    if (!ha[i - 1].bullish && ha[i].bullish) signals[i] = "LONG";
    else if (ha[i - 1].bullish && !ha[i].bullish) signals[i] = "SHORT";
  }
  return signals;
}

/** Proxy for live desk options-short-premium bias on rolling klines. */
function aiDeskSignals(candles: Candle[]): SignalSeries {
  const signals = emptySignals(candles.length);
  const prices = closes(candles);
  const ACTIONABLE = 35;

  for (let i = 50; i < candles.length; i += 1) {
    const slice = candles.slice(0, i + 1);
    const trend = detectTrendFromDaily(slice);
    const macdResult = macd(prices.slice(0, i + 1));
    const rsiVal = rsi(prices.slice(0, i + 1), 14) ?? 50;
    let score = 0;

    if (trend === "bullish") score += 35;
    else if (trend === "bearish") score -= 35;

    if (macdResult) {
      if (macdResult.histogram > 0) score += 12;
      else if (macdResult.histogram < 0) score -= 12;
    }

    if (rsiVal >= 70) score -= 8;
    else if (rsiVal <= 30) score += 8;

    if (score >= ACTIONABLE) signals[i] = "LONG";
    else if (score <= -ACTIONABLE) signals[i] = "SHORT";
  }

  return signals;
}

export function detectBarRegime(candles: Candle[], index: number): "bullish" | "bearish" | "neutral" {
  const slice = candles.slice(0, index + 1);
  if (slice.length < 50) return "neutral";
  return detectTrendFromDaily(slice);
}
