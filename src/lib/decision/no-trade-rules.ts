import type {
  LiquidationData,
  MacroEventStatus,
  MacroView,
  MarketSnapshot,
  NoTradeRuleResult,
  OptionCandidate,
  TechnicalSnapshot,
} from "@/lib/types/market";
import {
  ATR_MULTIPLIER,
  DELTA_FALLBACK_MAX,
  DELTA_FALLBACK_MIN,
  DELTA_SWEET_MAX,
  DELTA_SWEET_MIN,
  FUNDING_SHORT_CALL_SKIP,
  IV_HV_SKIP_THRESHOLD,
  LIQUIDATION_CAUTION,
  LIQUIDATION_SKIP,
  SD_SKIP_THRESHOLD,
} from "./thresholds";

export interface NoTradeContext {
  macroEvent: MacroEventStatus;
  liquidation: LiquidationData;
  macroView?: MacroView;
  technical4h?: TechnicalSnapshot;
  consecutiveLosses?: number;
  priorDayRallyPct?: number;
}

export function isIntendedShortCall(
  macroView: MacroView,
  candidate: OptionCandidate | undefined,
): boolean {
  if (macroView === "bearish") return true;
  if (macroView === "bullish") return false;
  return candidate?.optionType === "call";
}

export function isAtrTooClose(
  candidate: OptionCandidate | undefined,
  market: MarketSnapshot,
  technical4h: TechnicalSnapshot | undefined,
): boolean {
  if (!candidate || !technical4h || technical4h.atr4h <= 0) return false;
  return (
    Math.abs(candidate.strike - market.spotPrice) <=
    ATR_MULTIPLIER * technical4h.atr4h
  );
}

export function evaluateDeltaVerdict(
  absDelta: number,
): "trade_ok" | "wait" | "skip" {
  if (absDelta >= DELTA_SWEET_MIN && absDelta <= DELTA_SWEET_MAX) {
    return "trade_ok";
  }
  if (absDelta >= DELTA_FALLBACK_MIN && absDelta <= DELTA_FALLBACK_MAX) {
    return "wait";
  }
  return "skip";
}

/**
 * No-Trade Rules — hard stops from Playbook v2.0.
 * Any hard trigger → SKIP verdict (enforced in engine).
 */
export function evaluateNoTradeRules(
  market: MarketSnapshot,
  candidate: OptionCandidate | undefined,
  context: NoTradeContext,
): NoTradeRuleResult[] {
  const liq = context.liquidation.liquidation24h;
  const absDelta = candidate ? Math.abs(candidate.delta) : 0;
  const macroView = context.macroView ?? "neutral";
  const shortCall = isIntendedShortCall(macroView, candidate);
  const deltaVerdict =
    candidate !== undefined ? evaluateDeltaVerdict(absDelta) : "wait";
  const atrTooClose = isAtrTooClose(
    candidate,
    market,
    context.technical4h,
  );

  return [
    {
      id: "macro-event",
      name: "Macro Event Before Settlement",
      severity: "hard",
      triggered: context.macroEvent.hasEventBeforeSettlement,
      message: context.macroEvent.hasEventBeforeSettlement
        ? `FOMC/CPI/NFP${context.macroEvent.eventName ? ` (${context.macroEvent.eventName})` : ""} before 15:00 TH settlement — SKIP.`
        : "No FOMC/CPI/NFP event before settlement.",
    },
    {
      id: "iv-hv-min",
      name: "IV/HV Ratio Minimum",
      severity: "hard",
      triggered: market.ivHvRatio < IV_HV_SKIP_THRESHOLD,
      message:
        market.ivHvRatio < IV_HV_SKIP_THRESHOLD
          ? `IV/HV ${market.ivHvRatio.toFixed(2)} < ${IV_HV_SKIP_THRESHOLD} — SKIP.`
          : `IV/HV ${market.ivHvRatio.toFixed(2)} OK (≥ ${IV_HV_SKIP_THRESHOLD}).`,
    },
    {
      id: "sd-distance",
      name: "SD Distance Minimum",
      severity: "hard",
      triggered:
        candidate !== undefined && candidate.sdDistance < SD_SKIP_THRESHOLD,
      message:
        candidate !== undefined && candidate.sdDistance < SD_SKIP_THRESHOLD
          ? `SD distance ${candidate.sdDistance.toFixed(2)} < ${SD_SKIP_THRESHOLD} — SKIP.`
          : candidate
            ? `SD distance ${candidate.sdDistance.toFixed(2)} OK (≥ ${SD_SKIP_THRESHOLD}).`
            : "No candidate — SD check pending.",
    },
    {
      id: "liquidation-cascade",
      name: "Liquidation Cascade",
      severity: "hard",
      triggered: liq !== null && liq > LIQUIDATION_SKIP,
      message:
        liq !== null && liq > LIQUIDATION_SKIP
          ? `Liquidation $${(liq / 1_000_000).toFixed(0)}M > $200M — SKIP.`
          : liq === null
            ? "Liquidation data unavailable — rule not evaluated."
            : `Liquidation $${(liq / 1_000_000).toFixed(1)}M within limits.`,
    },
    {
      id: "liquidation-caution",
      name: "Liquidation Caution Zone",
      severity: "soft",
      triggered:
        liq !== null &&
        liq >= LIQUIDATION_CAUTION &&
        liq <= LIQUIDATION_SKIP,
      message:
        liq !== null &&
        liq >= LIQUIDATION_CAUTION &&
        liq <= LIQUIDATION_SKIP
          ? `Liquidation $${(liq / 1_000_000).toFixed(0)}M — CAUTION, reduce size.`
          : "Liquidation not in caution zone.",
    },
    {
      id: "funding-squeeze",
      name: "Funding Squeeze (Short Call)",
      severity: "hard",
      triggered:
        shortCall && market.fundingRate < FUNDING_SHORT_CALL_SKIP,
      message:
        shortCall && market.fundingRate < FUNDING_SHORT_CALL_SKIP
          ? `Funding ${(market.fundingRate * 100).toFixed(4)}% < -0.03% — SKIP Short Call.`
          : shortCall
            ? `Funding ${(market.fundingRate * 100).toFixed(4)}% OK for short call.`
            : "Short put context — funding squeeze rule not applied.",
    },
    {
      id: "delta-sweet-spot",
      name: "Delta Sweet Spot",
      severity: "soft",
      triggered:
        candidate !== undefined && deltaVerdict !== "trade_ok",
      message:
        candidate !== undefined
          ? deltaVerdict === "wait"
            ? `|Delta| ${absDelta.toFixed(2)} outside 0.13–0.15 — WAIT (fallback 0.08–0.18).`
            : deltaVerdict === "skip"
              ? `|Delta| ${absDelta.toFixed(2)} outside 0.08–0.18 — SKIP.`
              : `|Delta| ${absDelta.toFixed(2)} in sweet spot (0.13–0.15).`
          : "No candidate selected.",
    },
    {
      id: "atr-filter",
      name: "ATR Filter (4H)",
      severity: "soft",
      triggered: atrTooClose,
      message: atrTooClose
        ? "Strike within 1.5× 4H ATR — CAUTION, reduce size or WAIT."
        : candidate
          ? "Strike beyond 1.5× 4H ATR."
          : "No candidate — ATR check pending.",
    },
    {
      id: "prior-rally",
      name: "Prior Day Rally",
      severity: "hard",
      triggered: (context.priorDayRallyPct ?? 0) >= 5,
      message:
        (context.priorDayRallyPct ?? 0) >= 5
          ? "BTC rallied 5%+ prior day — SKIP."
          : "No excessive prior-day rally.",
    },
    {
      id: "loss-streak",
      name: "Consecutive Losses",
      severity: "hard",
      triggered: (context.consecutiveLosses ?? 0) >= 3,
      message:
        (context.consecutiveLosses ?? 0) >= 3
          ? "3 losses in a row — pause 2-3 days."
          : "Loss streak within limits.",
    },
  ];
}

export function isLiquidationCascadeTriggered(
  rules: NoTradeRuleResult[],
): boolean {
  return rules.some(
    (r) => r.id === "liquidation-cascade" && r.triggered,
  );
}

export function hasHardNoTradeTrigger(rules: NoTradeRuleResult[]): boolean {
  return rules.some((r) => r.triggered && r.severity === "hard");
}

export function hasSoftCaution(rules: NoTradeRuleResult[]): boolean {
  return rules.some((r) => r.triggered && r.severity === "soft");
}

export function isDeltaBlockingTrade(rules: NoTradeRuleResult[]): boolean {
  const delta = rules.find((r) => r.id === "delta-sweet-spot");
  return delta?.triggered === true;
}

export function isAtrCaution(rules: NoTradeRuleResult[]): boolean {
  const atr = rules.find((r) => r.id === "atr-filter");
  return atr?.triggered === true;
}

/** @deprecated */
export function hasNoTradeTrigger(rules: NoTradeRuleResult[]): boolean {
  return hasHardNoTradeTrigger(rules);
}
