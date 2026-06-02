import type {
  LiquidationData,
  MacroEventStatus,
  MarketSnapshot,
  NoTradeRuleResult,
  OptionCandidate,
} from "@/lib/types/market";

const IV_HV_SKIP_THRESHOLD = 1.15;
const SD_SKIP_THRESHOLD = 1.5;
const FUNDING_SHORT_CALL_SKIP = -0.0003;
const LIQUIDATION_SKIP = 200_000_000;

export interface NoTradeContext {
  macroEvent: MacroEventStatus;
  liquidation: LiquidationData;
  consecutiveLosses?: number;
  priorDayRallyPct?: number;
}

/**
 * No-Trade Rules — hard stops from Playbook v2.0.
 * Any hard trigger → SKIP verdict.
 */
export function evaluateNoTradeRules(
  market: MarketSnapshot,
  candidate: OptionCandidate | undefined,
  context: NoTradeContext,
): NoTradeRuleResult[] {
  const liq = context.liquidation.liquidation24h;
  const absDelta = candidate ? Math.abs(candidate.delta) : 0;

  return [
    {
      id: "macro-event",
      name: "Macro Event Before Settlement",
      severity: "hard",
      triggered: context.macroEvent.hasEventBeforeSettlement,
      message: context.macroEvent.hasEventBeforeSettlement
        ? `Macro event${context.macroEvent.eventName ? ` (${context.macroEvent.eventName})` : ""} before 15:00 TH settle — SKIP.`
        : "No macro event before settlement.",
    },
    {
      id: "iv-hv-min",
      name: "IV/HV Ratio Minimum",
      severity: "hard",
      triggered: market.ivHvRatio < IV_HV_SKIP_THRESHOLD,
      message:
        market.ivHvRatio < IV_HV_SKIP_THRESHOLD
          ? `IV/HV ${market.ivHvRatio.toFixed(2)} < ${IV_HV_SKIP_THRESHOLD} — SKIP.`
          : `IV/HV ${market.ivHvRatio.toFixed(2)} OK.`,
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
            ? `SD distance ${candidate.sdDistance.toFixed(2)} OK.`
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
        liq >= 50_000_000 &&
        liq <= LIQUIDATION_SKIP,
      message:
        liq !== null &&
        liq >= 50_000_000 &&
        liq <= LIQUIDATION_SKIP
          ? `Liquidation $${(liq / 1_000_000).toFixed(0)}M — CAUTION, reduce size.`
          : "Liquidation not in caution zone.",
    },
    {
      id: "funding-squeeze",
      name: "Funding Squeeze (Short Call)",
      severity: "hard",
      triggered:
        candidate?.optionType === "call" &&
        market.fundingRate < FUNDING_SHORT_CALL_SKIP,
      message:
        candidate?.optionType === "call" &&
        market.fundingRate < FUNDING_SHORT_CALL_SKIP
          ? `Funding ${(market.fundingRate * 100).toFixed(4)}% < -0.03% — SKIP Short Call.`
          : "Funding OK for short call.",
    },
    {
      id: "delta-sweet-spot",
      name: "Delta Sweet Spot",
      severity: "hard",
      triggered:
        candidate !== undefined &&
        (absDelta < 0.13 || absDelta > 0.15),
      message:
        candidate !== undefined
          ? absDelta >= 0.13 && absDelta <= 0.15
            ? `Delta ${absDelta.toFixed(2)} in sweet spot (0.13–0.15).`
            : `Delta ${absDelta.toFixed(2)} outside 0.13–0.15 — SKIP.`
          : "No candidate selected.",
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

export function hasHardNoTradeTrigger(rules: NoTradeRuleResult[]): boolean {
  return rules.some((r) => r.triggered && r.severity === "hard");
}

export function hasSoftCaution(rules: NoTradeRuleResult[]): boolean {
  return rules.some((r) => r.triggered && r.severity === "soft");
}

/** @deprecated */
export function hasNoTradeTrigger(rules: NoTradeRuleResult[]): boolean {
  return hasHardNoTradeTrigger(rules);
}
