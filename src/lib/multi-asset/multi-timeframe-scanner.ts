import { getLinearKlines, type BtcCandle } from "@/lib/bybit/klines";
import { fetchPerpTickerSnapshot } from "@/lib/bybit/perp-market";
import type { Candle } from "@/lib/indicators/technical";
import {
  SUPPORTED_PERP_ASSETS,
  type PerpAssetConfig,
} from "./asset-config";
import { runTimeframeChartFromCandles } from "./timeframe-chart-logic";
import type {
  MultiTimeframeScanResult,
  TimeframeChartSignal,
  TimeframeHorizon,
} from "./timeframe-types";

const DISCLAIMER =
  "Multi-timeframe chart scan — analysis-only. Short (1H), medium (4H), long (1D) agents run per asset.";

const HORIZONS: { horizon: TimeframeHorizon; interval: "60" | "240" | "D" }[] = [
  { horizon: "SHORT", interval: "60" },
  { horizon: "MEDIUM", interval: "240" },
  { horizon: "LONG", interval: "D" },
];

function toCandles(rows: BtcCandle[]): Candle[] {
  return rows.map((row) => ({
    timestamp: row.openTime,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  }));
}

function errorSignal(
  asset: PerpAssetConfig,
  horizon: TimeframeHorizon,
  message: string,
): TimeframeChartSignal {
  const label =
    horizon === "SHORT" ? "1H scalp" : horizon === "MEDIUM" ? "4H swing" : "1D position";
  return {
    assetId: asset.id,
    symbol: asset.symbol,
    label: asset.label,
    horizon,
    horizonLabel: label,
    price: 0,
    trend: "neutral",
    rsi14: 50,
    macdHistogram: 0,
    atr: 0,
    score: 0,
    direction: "FLAT",
    confidence: "LOW",
    actionable: false,
    stopLoss: null,
    takeProfit: null,
    reasons: [],
    risks: ["Data fetch failed — signal unavailable"],
    dataFresh: false,
    error: message,
  };
}

async function scanAssetTimeframes(
  asset: PerpAssetConfig,
): Promise<TimeframeChartSignal[]> {
  try {
    const ticker = await fetchPerpTickerSnapshot(asset.symbol);
    const klineRows = await Promise.all(
      HORIZONS.map(({ interval }) => getLinearKlines(asset.symbol, interval)),
    );

    return HORIZONS.map(({ horizon }, index) =>
      runTimeframeChartFromCandles({
        asset,
        ticker,
        candles: toCandles(klineRows[index]),
        horizon,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown scan error";
    return HORIZONS.map(({ horizon }) => errorSignal(asset, horizon, message));
  }
}

function countConfluence(signals: TimeframeChartSignal[]): number {
  const bySymbol = new Map<string, TimeframeChartSignal[]>();
  for (const signal of signals) {
    if (!signal.actionable || signal.direction === "FLAT") continue;
    const list = bySymbol.get(signal.symbol) ?? [];
    list.push(signal);
    bySymbol.set(signal.symbol, list);
  }

  let count = 0;
  for (const list of bySymbol.values()) {
    const longs = list.filter((s) => s.direction === "LONG").length;
    const shorts = list.filter((s) => s.direction === "SHORT").length;
    if (longs >= 2 || shorts >= 2) count += 1;
  }
  return count;
}

/**
 * Scans each asset on 1H (short), 4H (medium), and 1D (long) charts.
 * Returns flat signal list sorted by absolute conviction.
 */
export async function runMultiTimeframeScan(
  assets: PerpAssetConfig[] = SUPPORTED_PERP_ASSETS,
): Promise<MultiTimeframeScanResult> {
  const nested = await Promise.all(assets.map(scanAssetTimeframes));
  const signals = nested.flat();

  signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  return {
    generatedAt: new Date().toISOString(),
    signals,
    actionableCount: signals.filter((s) => s.actionable).length,
    confluenceCount: countConfluence(signals),
    errorCount: signals.filter((s) => s.error).length,
    disclaimer: DISCLAIMER,
  };
}
