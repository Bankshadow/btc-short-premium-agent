import type { TechnicalSnapshot } from "@/lib/types/market";

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MacdResult {
  macd: number;
  signal: number;
  histogram: number;
}

export interface SupportResistance {
  support: number;
  resistance: number;
}

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
}

export interface HeikinAshiCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  bullish: boolean;
}

const MS_PER_DAY = 365;
const DEFAULT_SR_LOOKBACK = 20;
const MACD_FAST = 12;
const MACD_SLOW = 26;
const MACD_SIGNAL = 9;

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}

/** Simple moving average of the latest window. Returns null if insufficient data. */
export function sma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;

  const window = values.slice(-period);
  const sum = window.reduce((acc, value) => acc + value, 0);
  return round(sum / period);
}

/** Exponential moving average. Returns null if insufficient data. */
export function ema(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;

  const multiplier = 2 / (period + 1);
  let emaValue =
    values.slice(0, period).reduce((acc, value) => acc + value, 0) / period;

  for (let i = period; i < values.length; i++) {
    emaValue = values[i] * multiplier + emaValue * (1 - multiplier);
  }

  return round(emaValue);
}

/**
 * Average True Range (Wilder's smoothing).
 * Intended for 4H candles per playbook framework.
 */
export function atr(candles: Candle[], period = 14): number | null {
  if (period <= 0 || candles.length < period + 1) return null;

  const trueRanges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previousClose = candles[i - 1].close;
    const range = Math.max(
      current.high - current.low,
      Math.abs(current.high - previousClose),
      Math.abs(current.low - previousClose),
    );
    trueRanges.push(range);
  }

  if (trueRanges.length < period) return null;

  let atrValue =
    trueRanges.slice(0, period).reduce((acc, value) => acc + value, 0) / period;

  for (let i = period; i < trueRanges.length; i++) {
    atrValue = (atrValue * (period - 1) + trueRanges[i]) / period;
  }

  return round(atrValue);
}

function buildMacdSeries(values: number[]): number[] {
  const series: number[] = [];

  for (let i = MACD_SLOW - 1; i < values.length; i++) {
    const slice = values.slice(0, i + 1);
    const fast = ema(slice, MACD_FAST);
    const slow = ema(slice, MACD_SLOW);
    if (fast === null || slow === null) continue;
    series.push(fast - slow);
  }

  return series;
}

/** Wilder's RSI. Returns null when insufficient data. */
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return round(100 - 100 / (1 + rs), 2);
}

/** Bollinger Bands (SMA middle, stddev bands). */
export function bollingerBands(
  values: number[],
  period = 20,
  stdDevMult = 2,
): BollingerBandsResult | null {
  if (period <= 0 || values.length < period) return null;
  const window = values.slice(-period);
  const middle = window.reduce((s, v) => s + v, 0) / period;
  const variance =
    window.reduce((s, v) => s + (v - middle) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  const upper = middle + stdDevMult * std;
  const lower = middle - stdDevMult * std;
  return {
    upper: round(upper),
    middle: round(middle),
    lower: round(lower),
    bandwidth: middle > 0 ? round(((upper - lower) / middle) * 100, 2) : 0,
  };
}

/** Convert OHLC candles to Heikin-Ashi series. */
export function heikinAshi(candles: Candle[]): HeikinAshiCandle[] {
  if (candles.length === 0) return [];
  const out: HeikinAshiCandle[] = [];
  let prevHaOpen = candles[0].open;
  let prevHaClose =
    (candles[0].open + candles[0].high + candles[0].low + candles[0].close) / 4;

  for (const c of candles) {
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = (prevHaOpen + prevHaClose) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    out.push({
      timestamp: c.timestamp,
      open: round(haOpen),
      high: round(haHigh),
      low: round(haLow),
      close: round(haClose),
      bullish: haClose >= haOpen,
    });
    prevHaOpen = haOpen;
    prevHaClose = haClose;
  }
  return out;
}

/** MACD (12, 26, 9). Returns null if insufficient data. */
export function macd(values: number[]): MacdResult | null {
  const macdSeries = buildMacdSeries(values);
  if (macdSeries.length < MACD_SIGNAL) return null;

  const macdLine = macdSeries.at(-1);
  const signalLine = ema(macdSeries, MACD_SIGNAL);
  if (macdLine === undefined || signalLine === null) return null;

  return {
    macd: round(macdLine, 4),
    signal: round(signalLine, 4),
    histogram: round(macdLine - signalLine, 4),
  };
}

/**
 * Historical volatility from daily log returns, annualized as a percentage.
 * Example: 21.5 means 21.5% annualized HV.
 */
export function historicalVolatility(
  candles: Candle[],
  period = 30,
): number | null {
  if (period <= 1 || candles.length < period + 1) return null;

  const recent = candles.slice(-(period + 1));
  const logReturns: number[] = [];

  for (let i = 1; i < recent.length; i++) {
    const prevClose = recent[i - 1].close;
    const currentClose = recent[i].close;
    if (prevClose <= 0 || currentClose <= 0) return null;
    logReturns.push(Math.log(currentClose / prevClose));
  }

  if (logReturns.length < period) return null;

  const mean =
    logReturns.reduce((acc, value) => acc + value, 0) / logReturns.length;
  const variance =
    logReturns.reduce((acc, value) => acc + (value - mean) ** 2, 0) /
    logReturns.length;
  const dailyStdDev = Math.sqrt(variance);

  return round(dailyStdDev * Math.sqrt(MS_PER_DAY) * 100, 2);
}

/**
 * Daily trend from EMA stack + MACD histogram.
 * Bullish: close > EMA20 > EMA50 and histogram > 0
 * Bearish: close < EMA20 < EMA50 and histogram < 0
 */
export function detectTrendFromDaily(
  candles: Candle[],
): "bullish" | "bearish" | "neutral" {
  const minBars = Math.max(50, MACD_SLOW + MACD_SIGNAL);
  if (candles.length < minBars) return "neutral";

  const closePrices = closes(candles);
  const lastClose = closePrices.at(-1);
  const ema20 = ema(closePrices, 20);
  const ema50 = ema(closePrices, 50);
  const macdResult = macd(closePrices);

  if (
    lastClose === undefined ||
    ema20 === null ||
    ema50 === null ||
    macdResult === null
  ) {
    return "neutral";
  }

  const bullish =
    lastClose > ema20 &&
    ema20 > ema50 &&
    macdResult.histogram > 0;
  const bearish =
    lastClose < ema20 &&
    ema20 < ema50 &&
    macdResult.histogram < 0;

  if (bullish) return "bullish";
  if (bearish) return "bearish";
  return "neutral";
}

/** Recent swing low/high over lookback window. Returns nulls if insufficient data. */
export function detectSupportResistance(
  candles: Candle[],
  lookback = DEFAULT_SR_LOOKBACK,
): SupportResistance | null {
  if (lookback <= 0 || candles.length < lookback) return null;

  const window = candles.slice(-lookback);
  const support = Math.min(...window.map((c) => c.low));
  const resistance = Math.max(...window.map((c) => c.high));

  return {
    support: round(support),
    resistance: round(resistance),
  };
}

function defaultSnapshot(symbol: string): TechnicalSnapshot {
  return {
    symbol,
    timestamp: new Date().toISOString(),
    rsi14: 50,
    ema20: 0,
    ema50: 0,
    ema200: 0,
    trend: "neutral",
    macdHistogram: 0,
    support: 0,
    resistance: 0,
    atr4h: 0,
  };
}

/**
 * Builds a technical snapshot from daily candles (trend/HV/SR)
 * and optional 4H candles (ATR).
 */
export function buildTechnicalSnapshot(
  symbol: string,
  dailyCandles: Candle[],
  h4Candles: Candle[] = [],
): TechnicalSnapshot {
  const snapshot = defaultSnapshot(symbol);

  if (dailyCandles.length === 0) return snapshot;

  const closePrices = closes(dailyCandles);
  const lastClose = closePrices.at(-1) ?? 0;
  const ema20 = ema(closePrices, 20);
  const ema50 = ema(closePrices, 50);
  const ema200 = ema(closePrices, 200);
  const macdResult = macd(closePrices);
  const levels = detectSupportResistance(dailyCandles);

  snapshot.ema20 = ema20 ?? lastClose;
  snapshot.ema50 = ema50 ?? lastClose;
  snapshot.ema200 = ema200 ?? lastClose;
  snapshot.trend = detectTrendFromDaily(dailyCandles);
  snapshot.macdHistogram = macdResult?.histogram ?? 0;
  snapshot.support = levels?.support ?? lastClose;
  snapshot.resistance = levels?.resistance ?? lastClose;

  const atr4h = atr(h4Candles.length > 0 ? h4Candles : dailyCandles, 14);
  snapshot.atr4h = atr4h ?? 0;

  return snapshot;
}
