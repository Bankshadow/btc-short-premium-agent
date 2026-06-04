import { getLinearKlines, type BtcCandle } from "@/lib/bybit/klines";
import { fetchPerpTickerSnapshot } from "@/lib/bybit/perp-market";
import type { Candle } from "@/lib/indicators/technical";
import {
  SUPPORTED_PERP_ASSETS,
  type PerpAssetConfig,
} from "./asset-config";
import { runPerpDirectionalAgent } from "./perp-directional-agent";
import type { MultiAssetScanResult, PerpDirectionalSignal } from "./types";

const DISCLAIMER =
  "Analysis-only / paper-first. Directional signals never place live orders. " +
  "Paper positions are simulated for learning and review.";

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
  message: string,
): PerpDirectionalSignal {
  return {
    assetId: asset.id,
    symbol: asset.symbol,
    label: asset.label,
    hasOptions: asset.hasOptions,
    price: 0,
    priceChange24hPct: 0,
    fundingRatePct: null,
    trend: "neutral",
    rsi14: 50,
    macdHistogram: 0,
    atr: 0,
    score: 0,
    direction: "FLAT",
    confidence: "LOW",
    actionable: false,
    suggestedSizePct: 0,
    stopLoss: null,
    takeProfit: null,
    reasons: [],
    risks: ["Data fetch failed — signal unavailable"],
    dataFresh: false,
    error: message,
  };
}

async function scanAsset(
  asset: PerpAssetConfig,
): Promise<PerpDirectionalSignal> {
  try {
    const [ticker, dailyRows, h4Rows] = await Promise.all([
      fetchPerpTickerSnapshot(asset.symbol),
      getLinearKlines(asset.symbol, "D"),
      getLinearKlines(asset.symbol, "240"),
    ]);

    return runPerpDirectionalAgent({
      asset,
      ticker,
      dailyCandles: toCandles(dailyRows),
      h4Candles: toCandles(h4Rows),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown scan error";
    return errorSignal(asset, message);
  }
}

/**
 * Scans every supported perp asset and returns ranked directional signals.
 * Strongest conviction first. Analysis-only.
 */
export async function runMultiAssetScan(
  assets: PerpAssetConfig[] = SUPPORTED_PERP_ASSETS,
): Promise<MultiAssetScanResult> {
  const signals = await Promise.all(assets.map(scanAsset));

  signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  return {
    generatedAt: new Date().toISOString(),
    signals,
    actionableCount: signals.filter((s) => s.actionable).length,
    errorCount: signals.filter((s) => s.error).length,
    disclaimer: DISCLAIMER,
  };
}
