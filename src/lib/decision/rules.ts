import type {
  CheckResult,
  CombinationReadResult,
  MacroView,
  MarketSnapshot,
  OptionCandidate,
  TechnicalSnapshot,
} from "@/lib/types/market";
import { combinationPatternOpposesTrade } from "./combination-read";
import {
  ATR_MULTIPLIER,
  DELTA_SWEET_MAX,
  DELTA_SWEET_MIN,
  IV_HV_SKIP_THRESHOLD,
  SD_SKIP_THRESHOLD,
} from "./thresholds";

/** Checks that must pass (not fail) for a TRADE verdict. ATR/confluence/funding warns are non-blocking. */
const CORE_TRADE_CHECK_IDS = new Set([
  "check-1-macro",
  "check-2-iv-hv",
  "check-3-sd",
  "check-8-combination",
]);

/** 8-Check Framework from Playbook §2.3 */
export function evaluateEightChecks(
  market: MarketSnapshot,
  technicalDaily: TechnicalSnapshot,
  technical4h: TechnicalSnapshot,
  candidate: OptionCandidate | undefined,
  combinationRead: CombinationReadResult,
  options: {
    macroEventBeforeSettlement: boolean;
    macroView?: MacroView;
  },
): CheckResult[] {
  const macroView = options.macroView ?? "neutral";
  const hypotheticalAction =
    macroView === "bearish"
      ? "sell_call"
      : macroView === "bullish"
        ? "sell_put"
        : candidate?.optionType === "put"
          ? "sell_put"
          : "sell_call";

  const absDelta = candidate ? Math.abs(candidate.delta) : 0;
  const sdPass = candidate != null && candidate.sdDistance >= SD_SKIP_THRESHOLD;
  const deltaPass =
    candidate != null &&
    absDelta >= DELTA_SWEET_MIN &&
    absDelta <= DELTA_SWEET_MAX;
  const fundingNeutral = Math.abs(market.fundingRate) <= 0.0001;
  const ivHvPass = market.ivHvRatio >= 1.15;

  const confluencePass =
    candidate != null && market.spotPrice > 0
      ? candidate.optionType === "call"
        ? candidate.strike >= technical4h.resistance * 0.98
        : candidate.strike <= technical4h.support * 1.02
      : false;

  const atrPass =
    candidate != null && technical4h.atr4h > 0
      ? Math.abs(candidate.strike - market.spotPrice) >
        ATR_MULTIPLIER * technical4h.atr4h
      : false;

  const combinationPass =
    combinationRead.dataStatus === "partial_data"
      ? false
      : !combinationPatternOpposesTrade(
          combinationRead.pattern,
          hypotheticalAction === "sell_put" ? "sell_put" : "sell_call",
        );

  const combinationStatus: CheckResult["status"] =
    combinationRead.dataStatus === "partial_data"
      ? "warn"
      : combinationPass
        ? "pass"
        : "fail";

  return [
    {
      id: "check-1-macro",
      name: "1. Macro Event",
      category: "macro",
      status: options.macroEventBeforeSettlement ? "fail" : "pass",
      message: options.macroEventBeforeSettlement
        ? "FOMC/CPI/NFP before 15:00 TH settlement — SKIP."
        : "No FOMC/CPI/NFP event before settlement.",
      weight: 1,
    },
    {
      id: "check-2-iv-hv",
      name: "2. IV/HV Ratio",
      category: "market",
      status: ivHvPass ? "pass" : "fail",
      message: `IV/HV ${market.ivHvRatio.toFixed(2)} (need ≥ ${IV_HV_SKIP_THRESHOLD}, ideal > 1.5).`,
      weight: 1,
    },
    {
      id: "check-3-sd",
      name: "3. SD Distance",
      category: "premium",
      status: candidate ? (sdPass ? "pass" : "fail") : "skip",
      message: candidate
        ? `${candidate.sdDistance.toFixed(2)} SD from spot (need ≥ ${SD_SKIP_THRESHOLD}).`
        : "No candidate strike selected.",
      weight: 1,
    },
    {
      id: "check-4-funding",
      name: "4. Funding Rate",
      category: "market",
      status: fundingNeutral ? "pass" : "warn",
      message: `Funding ${(market.fundingRate * 100).toFixed(4)}% (neutral ±0.01%).`,
      weight: 0.75,
    },
    {
      id: "check-5-delta",
      name: "5. Delta Sweet Spot",
      category: "premium",
      status: candidate ? (deltaPass ? "pass" : "fail") : "skip",
      message: candidate
        ? `|Delta| ${absDelta.toFixed(2)} (target ${DELTA_SWEET_MIN}–${DELTA_SWEET_MAX}).`
        : "No candidate strike selected.",
      weight: 1,
    },
    {
      id: "check-6-confluence",
      name: "6. Strike Confluence (4H)",
      category: "technical",
      status: candidate ? (confluencePass ? "pass" : "warn") : "skip",
      message: candidate
        ? confluencePass
          ? "Strike aligns with 4H support/resistance."
          : "Strike lacks 4H confluence."
        : "No candidate strike selected.",
      weight: 0.75,
    },
    {
      id: "check-7-atr",
      name: "7. ATR Filter (4H)",
      category: "technical",
      status: candidate ? (atrPass ? "pass" : "warn") : "skip",
      message: candidate
        ? atrPass
          ? "Strike beyond 1.5× 4H ATR."
          : "Strike within 1.5× 4H ATR — CAUTION, reduce size or WAIT."
        : "No candidate strike selected.",
      weight: 0.75,
    },
    {
      id: "check-8-combination",
      name: "8. Combination Read",
      category: "combination",
      status: combinationStatus,
      message:
        combinationRead.dataStatus === "partial_data"
          ? `PARTIAL_DATA — missing: ${combinationRead.missingFields.join(", ")}.`
          : `${combinationRead.label} — ${combinationRead.actionHint}`,
      weight: 1,
    },
    {
      id: "check-daily-trend",
      name: "Daily Trend Context",
      category: "technical",
      status:
        technicalDaily.trend === "neutral"
          ? "warn"
          : macroView === "bearish" && technicalDaily.trend === "bearish"
            ? "pass"
            : macroView === "bullish" && technicalDaily.trend === "bullish"
              ? "pass"
              : "warn",
      message: `Daily trend: ${technicalDaily.trend} (macro: ${macroView}).`,
      weight: 0.5,
    },
  ];
}

export function scoreChecks(checks: CheckResult[]): number {
  if (checks.length === 0) return 0;

  let earned = 0;
  let total = 0;

  for (const check of checks) {
    if (check.status === "skip") continue;
    total += check.weight;
    if (check.status === "pass") earned += check.weight;
    if (check.status === "warn") earned += check.weight * 0.5;
  }

  return total === 0 ? 0 : Math.round((earned / total) * 100);
}

export function hasCoreCheckFailure(checks: CheckResult[]): boolean {
  return checks.some(
    (c) => CORE_TRADE_CHECK_IDS.has(c.id) && c.status === "fail",
  );
}

export function allCriticalChecksPass(checks: CheckResult[]): boolean {
  const critical = checks.filter((c) => c.status !== "skip");
  return critical.every((c) => c.status === "pass");
}

export function resolveHypotheticalAction(
  macroView: MacroView,
  recommendation: "trade" | "skip" | "wait",
  candidate?: OptionCandidate,
): "sell_call" | "sell_put" | "no_trade" {
  if (recommendation !== "trade") return "no_trade";
  if (macroView === "bearish") return "sell_call";
  if (macroView === "bullish") return "sell_put";
  if (candidate?.optionType === "call") return "sell_call";
  if (candidate?.optionType === "put") return "sell_put";
  return "no_trade";
}

export function computeSlIndexPrice(
  candidate: OptionCandidate | undefined,
): number {
  if (!candidate) return 0;
  return candidate.optionType === "call"
    ? candidate.strike - 500
    : candidate.strike + 500;
}
