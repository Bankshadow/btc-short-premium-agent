import { LIQUIDATION_SKIP } from "@/lib/decision/thresholds";
import { computeEthCorrelation } from "@/lib/research/eth-correlation";
import { normalizeRegimeLabel } from "@/lib/validation/regime-router";
import type { RegimeBrainInput, RegimeBrainResult, RegimeEvidence, RegimeTaxonomy } from "./types";
import { REGIME_BRAIN_SAFETY_NOTICE } from "./types";
import {
  routeStrategiesForRegime,
  taxonomyToDeskLabel,
} from "./route-strategies";

type ScoreMap = Partial<Record<RegimeTaxonomy, number>>;

function addScore(
  scores: ScoreMap,
  regime: RegimeTaxonomy,
  weight: number,
  evidence: RegimeEvidence[],
  signal: string,
  value: string,
): void {
  scores[regime] = (scores[regime] ?? 0) + weight;
  evidence.push({ signal, value, weight, supports: regime });
}

function pickPrimary(scores: ScoreMap): RegimeTaxonomy {
  const sorted = Object.entries(scores).sort(
    ([, a], [, b]) => (b as number) - (a as number),
  ) as [RegimeTaxonomy, number][];
  return sorted[0]?.[0] ?? "SIDEWAYS";
}

function pickSecondary(
  scores: ScoreMap,
  primary: RegimeTaxonomy,
): RegimeTaxonomy[] {
  return (Object.entries(scores) as [RegimeTaxonomy, number][])
    .filter(([k, v]) => k !== primary && v >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k]) => k);
}

export function detectMarketRegime(input: RegimeBrainInput): RegimeBrainResult {
  const { input: engine, response, ethQuote, recentEntries, relevantMemory } =
    input;
  const market = engine.market;
  const daily = engine.technicalDaily;
  const h4 = engine.technical4h;
  const combo = response.step4_combinationRead;
  const liq = engine.liquidation.liquidation24h;
  const evidence: RegimeEvidence[] = [];
  const scores: ScoreMap = {};
  const risks: string[] = [];

  if (engine.macroEvent.hasEventBeforeSettlement) {
    addScore(scores, "MACRO_EVENT_RISK", 10, evidence, "Macro event", "pre-settlement",);
    risks.push("Macro event window — reduce or pause new trades.");
  }

  if (liq != null && liq > LIQUIDATION_SKIP) {
    addScore(scores, "LIQUIDATION_RISK", 12, evidence, "Liquidation 24h", String(liq));
    addScore(scores, "HIGH_VOLATILITY", 6, evidence, "Liquidation stress", "elevated");
    risks.push("Liquidation cascade risk elevated.");
  }

  if (combo.pattern === "long_capitulation") {
    addScore(scores, "LIQUIDATION_RISK", 8, evidence, "Combination", "long_capitulation");
    addScore(scores, "HIGH_VOLATILITY", 5, evidence, "Capitulation", "detected");
  }

  const change24h = market.priceChange24hPct ?? 0;
  if (daily.trend === "bullish" && change24h > 1.5) {
    addScore(scores, "BULL_TREND", 8, evidence, "Daily trend", `bullish +${change24h.toFixed(1)}%`);
  }
  if (daily.trend === "bearish" && change24h < -1.5) {
    addScore(scores, "BEAR_TREND", 8, evidence, "Daily trend", `bearish ${change24h.toFixed(1)}%`);
  }
  if (daily.trend === "neutral" && Math.abs(change24h) < 2) {
    addScore(scores, "SIDEWAYS", 6, evidence, "Daily trend", "neutral");
    addScore(scores, "RANGE_BOUND_PREMIUM_SELLING", 5, evidence, "Range", "tight");
  }

  const ivHv = market.ivHvRatio;
  if (ivHv > 0 && ivHv < 0.85) {
    addScore(scores, "VOL_COMPRESSION", 5, evidence, "IV/HV", ivHv.toFixed(2));
    addScore(scores, "RANGE_BOUND_PREMIUM_SELLING", 4, evidence, "Premium context", "compressed vol");
  } else if (ivHv >= 1.15) {
    addScore(scores, "VOL_EXPANSION", 6, evidence, "IV/HV", ivHv.toFixed(2));
    addScore(scores, "HIGH_VOLATILITY", 4, evidence, "Vol expansion", "IV>HV");
    risks.push("Vol expansion — widen risk buffers.");
  } else if (ivHv > 0 && ivHv < 1) {
    addScore(scores, "LOW_VOLATILITY", 4, evidence, "IV/HV", ivHv.toFixed(2));
  }

  if (market.hv30 > 0 && market.hv30 < 18) {
    addScore(scores, "LOW_VOLATILITY", 3, evidence, "HV30", String(market.hv30));
  } else if (market.hv30 >= 35) {
    addScore(scores, "HIGH_VOLATILITY", 5, evidence, "HV30", String(market.hv30));
  }

  const funding = market.fundingRate ?? 0;
  if (Math.abs(funding) > 0.0005) {
    addScore(scores, "BREAKOUT_RISK", 3, evidence, "Funding", funding.toFixed(4));
  }

  const oiCh = market.oiChange24hPct;
  if (oiCh != null && Math.abs(oiCh) > 8) {
    addScore(scores, "BREAKOUT_RISK", 4, evidence, "OI 24h change", `${oiCh.toFixed(1)}%`);
  }

  const ethRead = computeEthCorrelation(market.priceChange24hPct, ethQuote ?? null);
  if (ethRead.alignment === "divergent") {
    addScore(scores, "BREAKOUT_RISK", 3, evidence, "ETH/BTC", "divergent");
    risks.push("ETH/BTC divergence — cross-asset risk.");
  }

  if (h4.trend !== daily.trend && daily.trend !== "neutral") {
    addScore(scores, "BREAKOUT_RISK", 2, evidence, "4H vs daily", `${h4.trend}/${daily.trend}`);
  }

  const resolved = (recentEntries ?? []).filter((e) => e.outcomeStatus === "RESOLVED");
  if (resolved.length >= 3) {
    const recentLosses = resolved
      .slice(0, 5)
      .filter((e) => (e.paperPnl ?? 0) < 0).length;
    if (recentLosses >= 3) {
      addScore(scores, "HIGH_VOLATILITY", 2, evidence, "Recent outcomes", `${recentLosses} losses`);
      risks.push("Recent desk losses — caution on sizing.");
    }
  }

  if ((relevantMemory?.lessons.length ?? 0) > 0) {
    const lesson = relevantMemory!.lessons[0];
    if (/poor|weak|avoid|loss/i.test(lesson.bullet)) {
      risks.push(`Memory: ${lesson.bullet}`);
    }
  }

  if (Object.keys(scores).length === 0) {
    addScore(scores, "SIDEWAYS", 3, evidence, "Default", "insufficient signals");
  }

  const primary = pickPrimary(scores);
  const secondary = pickSecondary(scores, primary);
  const routing = routeStrategiesForRegime(primary);
  const deskLabel = taxonomyToDeskLabel(primary);
  const canonicalRegime = normalizeRegimeLabel(deskLabel);

  const maxScore = Math.max(...Object.values(scores), 1);
  const primaryScore = scores[primary] ?? 0;
  const confidence = Math.min(
    95,
    Math.round(45 + (primaryScore / maxScore) * 45),
  );

  return {
    generatedAt: new Date().toISOString(),
    primaryRegime: primary,
    secondaryRegimes: secondary,
    canonicalRegime,
    deskLabel,
    regimeConfidence: confidence,
    regimeRisks: risks,
    evidence: evidence.sort((a, b) => b.weight - a.weight).slice(0, 12),
    recommendedStrategies: routing.recommended,
    blockedStrategies: routing.blocked,
    sizingMultiplier: routing.sizingMultiplier,
    tradeFrequencyRecommendation: routing.tradeFrequency,
    safetyNotice: REGIME_BRAIN_SAFETY_NOTICE,
    advisoryOnly: true,
    cannotOverrideRiskVeto: true,
    cannotEnableLive: true,
  };
}
