import type { DecisionEngineInput, SpotQuote } from "@/lib/types/market";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DeskMemoryClientPayload } from "@/lib/memory/types";
import { hasAnyOverride } from "@/lib/decision/derivatives-overrides";
import {
  ageSecondsFromIso,
  evaluateBtcPriceFreshness,
  evaluateFundingFreshness,
  evaluateLiquidationFreshness,
  evaluateMacroCalendarPresent,
  evaluateManualDataFreshness,
  evaluateMockInProduction,
  evaluateOptionChainIntegrity,
  worstConfidence,
} from "./data-freshness";
import type { DataProvenanceField, DataSourceKind } from "./types";

export interface BuildProvenanceInput {
  input: DecisionEngineInput;
  response: AnalyzeApiResponse;
  ethQuote?: SpotQuote | null;
  deskMemoryPayload?: DeskMemoryClientPayload;
  analyzedAt: string;
  isProduction?: boolean;
}

function field(
  fieldName: string,
  value: unknown,
  source: DataSourceKind,
  updatedAt: string | null,
  freshnessSeconds: number | null,
  confidence: DataProvenanceField["confidence"],
  issue?: string,
): DataProvenanceField {
  return {
    fieldName,
    value,
    source,
    updatedAt,
    freshnessSeconds,
    confidence,
    issue,
  };
}

function liquidationSource(
  liq: DecisionEngineInput["liquidation"],
  hasManual: boolean,
): DataSourceKind {
  if (liq.liquidation24h === null && !hasManual) return "MISSING";
  if (hasManual) return "MANUAL";
  if (liq.source === "mock") return "MOCK";
  if (liq.source === "manual") return "MANUAL";
  return "COINGLASS";
}

function optionChainGaps(
  candidates: DecisionEngineInput["optionCandidates"],
): string[] {
  if (candidates.length === 0) return ["candidates"];
  const gaps: string[] = [];
  const best = candidates[0];
  if (!best.bid || best.bid <= 0) gaps.push("bid");
  if (!best.ask || best.ask <= 0) gaps.push("ask");
  if (!best.impliedVolatility || best.impliedVolatility <= 0) gaps.push("iv");
  if (best.delta === undefined || Number.isNaN(best.delta)) gaps.push("delta");
  return gaps;
}

export function buildDataProvenance(ctx: BuildProvenanceInput): DataProvenanceField[] {
  const { input, response, ethQuote, analyzedAt } = ctx;
  const nowMs = Date.parse(analyzedAt) || Date.now();
  const market = input.market;
  const liq = input.liquidation;
  const manual = hasAnyOverride(input.derivativesOverrides ?? {});
  const manualAt = manual ? analyzedAt : null;
  const manualAge = ageSecondsFromIso(manualAt, nowMs);
  const marketAge = ageSecondsFromIso(market.timestamp, nowMs);
  const isProduction = ctx.isProduction ?? process.env.NODE_ENV === "production";

  const btcFresh = evaluateBtcPriceFreshness(marketAge);
  const fundingFresh = evaluateFundingFreshness(marketAge);
  const liqFresh = evaluateLiquidationFreshness(marketAge);
  const macroFresh = evaluateMacroCalendarPresent(
    input.macroEvent.hasEventBeforeSettlement,
  );
  const manualFresh = manual
    ? evaluateManualDataFreshness(manualAge)
    : { confidence: "HIGH" as const };
  const mockFresh = evaluateMockInProduction(liq.source === "mock", isProduction);
  const optionGaps = optionChainGaps(input.optionCandidates);
  const optionFresh = evaluateOptionChainIntegrity(
    input.optionCandidates.length,
    optionGaps,
  );

  const liqSrc = liquidationSource(liq, manual);

  const fields: DataProvenanceField[] = [
    field(
      "BTC price",
      market.spotPrice,
      market.spotPrice > 0 ? "BYBIT" : "MISSING",
      market.timestamp,
      marketAge,
      market.spotPrice <= 0 ? "CRITICAL" : btcFresh.confidence,
      market.spotPrice <= 0 ? "BTC spot unavailable" : btcFresh.issue,
    ),
    field(
      "ETH price",
      ethQuote?.price ?? null,
      ethQuote ? "BYBIT" : "MISSING",
      ethQuote?.timestamp ?? null,
      ageSecondsFromIso(ethQuote?.timestamp, nowMs),
      ethQuote ? "HIGH" : "LOW",
      ethQuote ? undefined : "ETH quote not supplied",
    ),
    field(
      "Funding rate",
      market.fundingRate,
      manual && input.derivativesOverrides?.oi24hChange != null ? "MANUAL" : "BYBIT",
      market.timestamp,
      marketAge,
      fundingFresh.confidence,
      fundingFresh.issue,
    ),
    field(
      "Open interest",
      market.openInterestBtc,
      "BYBIT",
      market.timestamp,
      marketAge,
      market.openInterestBtc > 0 ? "HIGH" : "LOW",
    ),
    field(
      "Liquidation 24h",
      liq.liquidation24h,
      liqSrc,
      market.timestamp,
      marketAge,
      liq.liquidation24h == null ? "LOW" : liqFresh.confidence,
      liq.liquidation24h == null
        ? "Liquidation missing — override or live feed required"
        : liqFresh.issue,
    ),
    field(
      "Volume 24h change",
      market.volumeChange24hPct,
      manual ? "MANUAL" : market.volumeChange24hPct != null ? "BYBIT" : "MISSING",
      manualAt ?? market.timestamp,
      manual ? manualAge : marketAge,
      market.volumeChange24hPct == null ? "LOW" : "HIGH",
    ),
    field(
      "OI 1h change",
      market.oiChange1hPct,
      manual ? "MANUAL" : market.oiChange1hPct != null ? "BYBIT" : "MISSING",
      manualAt ?? market.timestamp,
      manual ? manualAge : marketAge,
      market.oiChange1hPct == null ? "LOW" : "HIGH",
    ),
    field(
      "OI 24h change",
      market.oiChange24hPct,
      manual ? "MANUAL" : market.oiChange24hPct != null ? "BYBIT" : "MISSING",
      manualAt ?? market.timestamp,
      manual ? manualAge : marketAge,
      market.oiChange24hPct == null ? "LOW" : "HIGH",
    ),
    field(
      "Option IV",
      input.optionCandidates[0]?.impliedVolatility ?? null,
      input.optionCandidates.length ? "BYBIT" : "MISSING",
      market.timestamp,
      marketAge,
      optionFresh.confidence,
      optionFresh.issue,
    ),
    field(
      "Option delta",
      input.optionCandidates[0]?.delta ?? null,
      input.optionCandidates.length ? "BYBIT" : "MISSING",
      market.timestamp,
      marketAge,
      optionFresh.confidence,
    ),
    field(
      "HV 30D",
      market.hv30,
      "DERIVED",
      market.timestamp,
      marketAge,
      market.hv30 > 0 ? "HIGH" : "LOW",
    ),
    field(
      "Macro event status",
      input.macroEvent.hasEventBeforeSettlement,
      "LOCAL_STORAGE",
      analyzedAt,
      0,
      macroFresh.confidence,
      macroFresh.issue,
    ),
    field(
      "News / research summary",
      response.tradingDesk?.research.summaryBullets?.[0] ?? null,
      "DERIVED",
      response.tradingDesk?.research.generatedAt ?? analyzedAt,
      ageSecondsFromIso(response.tradingDesk?.research.generatedAt ?? analyzedAt, nowMs),
      (response.tradingDesk?.research.dataQualityScore ?? 0) < 50 ? "LOW" : "HIGH",
    ),
    field(
      "ETH/BTC quote",
      ethQuote
        ? `${ethQuote.price} (${ethQuote.priceChange24hPct}%)`
        : null,
      ethQuote ? "BYBIT" : "MISSING",
      ethQuote?.timestamp ?? null,
      ageSecondsFromIso(ethQuote?.timestamp, nowMs),
      ethQuote ? "HIGH" : "MEDIUM",
    ),
    field(
      "Risk profile",
      input.deskRiskProfile ?? "balanced",
      "LOCAL_STORAGE",
      analyzedAt,
      0,
      "HIGH",
    ),
    field(
      "Desk memory",
      ctx.deskMemoryPayload ? "loaded" : "empty",
      "LOCAL_STORAGE",
      analyzedAt,
      0,
      "HIGH",
    ),
    field(
      "Manual overrides",
      manual ? input.derivativesOverrides : null,
      manual ? "MANUAL" : "MISSING",
      manualAt,
      manualAge,
      manualFresh.confidence,
      manualFresh.issue,
    ),
    field(
      "Data environment",
      liq.source,
      liq.source === "mock" ? "MOCK" : "BYBIT",
      analyzedAt,
      0,
      mockFresh.confidence,
      mockFresh.issue,
    ),
  ];

  for (const f of fields) {
    if (!f.issue && f.confidence !== "HIGH") {
      const refreshed = worstConfidence([f.confidence]);
      f.confidence = refreshed;
    }
  }

  return fields;
}
