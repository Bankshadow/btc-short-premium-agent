import type { DecisionEngineInput, OptionCandidate } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { HistoricalMarketBar } from "./types";
import {
  buildHistoricalOptionsSnapshot,
  inferLiquidationProxy,
  inferMacroEvent,
} from "./reconstruct-bar";

function buildTechnical(
  bar: HistoricalMarketBar,
  scale: number,
): DecisionEngineInput["technicalDaily"] {
  const support = bar.spotPrice * (1 - 0.02 * scale);
  const resistance = bar.spotPrice * (1 + 0.02 * scale);
  return {
    symbol: "BTCUSDT",
    timestamp: bar.timestamp,
    rsi14: bar.trend === "bullish" ? 58 : bar.trend === "bearish" ? 42 : 50,
    ema20: bar.spotPrice * 0.998,
    ema50: bar.spotPrice * 0.995,
    ema200: bar.spotPrice * 0.98,
    trend: bar.trend,
    macdHistogram: bar.trend === "bullish" ? 0.5 : bar.trend === "bearish" ? -0.5 : 0,
    support,
    resistance,
    atr4h: bar.spotPrice * 0.015,
  };
}

export function generateOptionsCandidates(
  bar: HistoricalMarketBar,
): OptionCandidate[] {
  const snap = buildHistoricalOptionsSnapshot(bar);
  const strikes = [
    snap.bestStrike,
    Math.round(bar.spotPrice * 1.08 / 500) * 500,
    Math.round(bar.spotPrice * 1.03 / 500) * 500,
  ];

  return strikes.map((strike, i) => ({
    symbol: `BTC-${snap.bestExpiry.replace(/-/g, "")}-${strike}-C`,
    strike,
    expiry: snap.bestExpiry,
    optionType: "call" as const,
    markPrice: 800 + i * 120,
    bid: 780 + i * 120,
    ask: 820 + i * 120,
    impliedVolatility: snap.impliedVolatility,
    delta: 0.12 + i * 0.03,
    theta: -1.2,
    premiumUsd: 800 + i * 120,
    annualizedYieldPct: snap.annualizedYieldPct - i,
    otmPct: ((strike - bar.spotPrice) / bar.spotPrice) * 100,
    sdDistance: 1 + i * 0.3,
  }));
}

export function buildEngineInputFromBar(input: {
  entry: DecisionLogEntry;
  bar: HistoricalMarketBar;
  riskProfile: DeskRiskProfile;
  consecutiveLosses?: number;
}): DecisionEngineInput {
  const macro = inferMacroEvent(input.entry);
  const liquidation24h = inferLiquidationProxy(input.entry, input.bar);

  return {
    market: {
      symbol: "BTCUSDT",
      spotPrice: input.bar.spotPrice,
      timestamp: input.bar.timestamp,
      hv30: input.bar.hv30,
      iv: input.bar.iv,
      ivHvRatio: input.bar.ivHvRatio,
      ivRank: input.bar.ivRank,
      ivPercentile: input.bar.ivPercentile,
      fundingRate: input.bar.fundingRate,
      openInterestBtc: input.bar.openInterestBtc,
      oiChange24hPct: input.bar.oiChange24hPct,
      oiChange1hPct: input.bar.oiChange24hPct / 24,
      volume24hBtc: input.bar.volume24hBtc,
      volumeChange24hPct: input.bar.volumeChange24hPct,
      priceChange24hPct: input.bar.priceChange24hPct,
    },
    optionCandidates: generateOptionsCandidates(input.bar),
    technicalDaily: buildTechnical(input.bar, 1),
    technical4h: buildTechnical(input.bar, 0.8),
    technical1h: buildTechnical(input.bar, 0.5),
    macroEvent: {
      hasEventBeforeSettlement: macro.hasEventBeforeSettlement,
      eventName: macro.eventLabel ?? undefined,
    },
    liquidation: {
      liquidation24h: liquidation24h,
      source: "mock",
    },
    macroView: "bearish",
    deskRiskProfile: input.riskProfile,
    consecutiveLosses: input.consecutiveLosses ?? 0,
  };
}
