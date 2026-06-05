import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type {
  HistoricalFundingSnapshot,
  HistoricalMarketBar,
  HistoricalOptionsSnapshot,
  HistoricalRegimeSnapshot,
} from "./types";
import type { RegimeTaxonomy } from "@/lib/market-regime-brain/types";

function inferTrend(
  regime: string,
): "bullish" | "bearish" | "neutral" {
  const lower = regime.toLowerCase();
  if (lower.includes("bull") || lower.includes("risk-on")) return "bullish";
  if (lower.includes("bear") || lower.includes("risk-off")) return "bearish";
  return "neutral";
}

function inferVolProfile(regime: string): {
  hv30: number;
  iv: number;
  ivHvRatio: number;
  ivRank: number;
  ivPercentile: number;
} {
  const lower = regime.toLowerCase();
  if (lower.includes("high vol") || lower.includes("liquidation")) {
    return { hv30: 38, iv: 48, ivHvRatio: 1.26, ivRank: 72, ivPercentile: 75 };
  }
  if (lower.includes("low vol") || lower.includes("compression")) {
    return { hv30: 16, iv: 20, ivHvRatio: 0.82, ivRank: 28, ivPercentile: 30 };
  }
  if (lower.includes("premium") || lower.includes("range")) {
    return { hv30: 22, iv: 24, ivHvRatio: 0.92, ivRank: 42, ivPercentile: 45 };
  }
  return { hv30: 26, iv: 30, ivHvRatio: 1.05, ivRank: 50, ivPercentile: 52 };
}

function inferTaxonomy(regime: string): RegimeTaxonomy {
  const lower = regime.toLowerCase();
  if (lower.includes("liquidation")) return "LIQUIDATION_RISK";
  if (lower.includes("macro")) return "MACRO_EVENT_RISK";
  if (lower.includes("premium")) return "RANGE_BOUND_PREMIUM_SELLING";
  if (lower.includes("bull") || lower.includes("risk-on")) return "BULL_TREND";
  if (lower.includes("bear") || lower.includes("risk-off")) return "BEAR_TREND";
  if (lower.includes("high vol")) return "HIGH_VOLATILITY";
  if (lower.includes("low vol")) return "LOW_VOLATILITY";
  if (lower.includes("range") || lower.includes("sideways")) return "SIDEWAYS";
  return "SIDEWAYS";
}

export function buildHistoricalMarketBar(
  entry: DecisionLogEntry,
  prevPrice: number | null,
): HistoricalMarketBar {
  const vol = inferVolProfile(entry.marketRegime);
  const trend = inferTrend(entry.marketRegime);
  const priceChange24hPct =
    prevPrice && prevPrice > 0
      ? Number((((entry.btcPrice - prevPrice) / prevPrice) * 100).toFixed(2))
      : trend === "bullish"
        ? 2
        : trend === "bearish"
          ? -2
          : 0.5;

  const fundingRate =
    entry.topReasons.some((r) => /funding|crowded/i.test(r)) ? 0.0008 : 0.0001;
  const oiChange24hPct =
    entry.topReasons.some((r) => /oi|open interest/i.test(r)) ? 6 : 2;

  return {
    timestamp: entry.timestamp,
    spotPrice: entry.btcPrice,
    priceChange24hPct,
    trend,
    fundingRate,
    openInterestBtc: Math.round(entry.btcPrice * 1.5),
    oiChange24hPct,
    volume24hBtc: 45000,
    volumeChange24hPct: 4,
    ...vol,
  };
}

export function buildHistoricalFundingSnapshot(
  bar: HistoricalMarketBar,
): HistoricalFundingSnapshot {
  return {
    timestamp: bar.timestamp,
    fundingRate: bar.fundingRate,
    openInterestBtc: bar.openInterestBtc,
    oiChange24hPct: bar.oiChange24hPct,
  };
}

export function buildHistoricalOptionsSnapshot(
  bar: HistoricalMarketBar,
): HistoricalOptionsSnapshot {
  const strike = Math.round(bar.spotPrice * 1.05 / 500) * 500;
  return {
    timestamp: bar.timestamp,
    spotPrice: bar.spotPrice,
    candidateCount: 3,
    bestStrike: strike,
    bestExpiry: "2026-06-27",
    impliedVolatility: bar.iv,
    annualizedYieldPct: bar.ivHvRatio < 1 ? 14 : 9,
  };
}

export function buildHistoricalRegimeSnapshot(
  entry: DecisionLogEntry,
): HistoricalRegimeSnapshot {
  const primaryRegime = inferTaxonomy(entry.marketRegime);
  return {
    timestamp: entry.timestamp,
    deskLabel: entry.marketRegime,
    primaryRegime,
    confidence: 65,
  };
}

export function inferMacroEvent(entry: DecisionLogEntry): {
  hasEventBeforeSettlement: boolean;
  eventLabel: string | null;
} {
  const macro = entry.topReasons.some((r) => /macro|fomc|cpi|fed/i.test(r));
  return {
    hasEventBeforeSettlement: macro,
    eventLabel: macro ? "Historical macro flag" : null,
  };
}

export function inferLiquidationProxy(
  entry: DecisionLogEntry,
  bar: HistoricalMarketBar,
): number {
  if (entry.marketRegime.toLowerCase().includes("liquidation")) {
    return 400_000_000;
  }
  if (bar.ivHvRatio >= 1.2) return 180_000_000;
  return 60_000_000;
}
