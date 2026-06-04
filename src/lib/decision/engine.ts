import type {
  CheckResult,
  DecisionEngineInput,
  DecisionEngineOutput,
  LiquidationData,
  OptionCandidate,
  TradeRecommendation,
} from "@/lib/types/market";
import {
  evaluateCombinationRead,
  isLiquidationCaution,
} from "./combination-read";
import {
  evaluateDeltaVerdict,
  evaluateNoTradeRules,
  hasHardNoTradeTrigger,
  hasSoftCaution,
  isAtrCaution,
  isLiquidationCascadeTriggered,
} from "./no-trade-rules";
import {
  computeSlIndexPrice,
  evaluateEightChecks,
  hasCoreCheckFailure,
  resolveHypotheticalAction,
  scoreChecks,
} from "./rules";
import {
  engineAllowsCoreFailureTrade,
  engineAllowsWaitAsTrade,
  engineDeltaWaitAsTradeOk,
  isAggressiveDeskRisk,
} from "@/lib/desk/desk-risk-policy";

const HARD_RULE_CONFIDENCE = 100;
const LIQUIDATION_CASCADE_SUMMARY =
  "Liquidation above $200M hard no-trade rule";
const LIQUIDATION_CASCADE_ACTION =
  "No order. Wait for liquidation to normalize below $50M.";

const ANALYSIS_DISCLAIMER =
  "Analysis only. Co-pilot — not auto-pilot. This agent does not place or route real orders.";

const SETTLEMENT_TIME_TH = "15:00";
const PIN_EXIT_TIME_TH = "13:30";
const FULL_SIZE_PCT = 2.5;
const CAUTION_SIZE_PCT = 1.75;

function selectCandidate(candidates: OptionCandidate[]): OptionCandidate | undefined {
  const sorted = [...candidates].sort(
    (a, b) =>
      Math.abs(Math.abs(a.delta) - 0.14) - Math.abs(Math.abs(b.delta) - 0.14),
  );
  return sorted[0];
}

function detectMissingRequiredData(input: DecisionEngineInput): string[] {
  const missing: string[] = [];

  if (input.market.spotPrice <= 0) missing.push("market.spotPrice");
  if (input.market.hv30 <= 0) missing.push("market.hv30");
  if (input.market.iv <= 0) missing.push("market.iv");
  if (input.market.ivHvRatio <= 0) missing.push("market.ivHvRatio");
  if (input.optionCandidates.length === 0) missing.push("optionCandidates");

  return missing;
}

function resolveDeltaRecommendation(
  candidate: OptionCandidate | undefined,
): TradeRecommendation | null {
  if (!candidate) return null;

  const verdict = evaluateDeltaVerdict(Math.abs(candidate.delta));
  if (verdict === "skip") return "skip";
  if (verdict === "wait") return "wait";
  return null;
}

function countActiveCautions(
  atrCaution: boolean,
  liquidation: LiquidationData,
  checks: CheckResult[],
): number {
  return [
    atrCaution,
    isLiquidationCaution(liquidation),
    checks.find((c) => c.id === "check-6-confluence")?.status === "warn",
    checks.find((c) => c.id === "check-4-funding")?.status === "warn",
  ].filter(Boolean).length;
}

function resolveVerdict(
  hardSkip: boolean,
  missingData: string[],
  combinationPattern: string,
  deltaRecommendation: TradeRecommendation | null,
  coreCheckFailure: boolean,
  atrCaution: boolean,
  activeCautionCount: number,
): TradeRecommendation {
  if (hardSkip) return "skip";
  if (missingData.length > 0) return "wait";
  if (combinationPattern === "long_capitulation") return "skip";
  if (deltaRecommendation === "skip") return "skip";
  if (coreCheckFailure) return "skip";
  if (deltaRecommendation === "wait") return "wait";
  if (atrCaution && activeCautionCount >= 2) return "wait";
  return "trade";
}

function buildSummary(
  recommendation: TradeRecommendation,
  confidence: number,
  hardSkip: boolean,
  liquidationCascade: boolean,
  missingData: string[],
  coreCheckFailure: boolean,
  combinationReadLabel: string,
  deltaRecommendation: TradeRecommendation | null,
  atrCaution: boolean,
): string {
  if (liquidationCascade) return LIQUIDATION_CASCADE_SUMMARY;
  if (hardSkip) return "Hard No-Trade Rule triggered — SKIP.";
  if (missingData.length > 0) {
    return `Required data missing (${missingData.join(", ")}) — WAIT.`;
  }
  if (combinationReadLabel.includes("Long Capitulation")) {
    return "Combination Read: Long Capitulation — SKIP.";
  }
  if (deltaRecommendation === "skip") {
    return "|Delta| outside 0.08–0.18 — SKIP.";
  }
  if (coreCheckFailure) {
    return `Core checks not passed — SKIP (${confidence}/100 score).`;
  }
  if (deltaRecommendation === "wait") {
    return "|Delta| outside 0.13–0.15 sweet spot — WAIT.";
  }
  if (recommendation === "wait" && atrCaution) {
    return "ATR filter too close with multiple caution flags — WAIT.";
  }
  if (recommendation === "trade") {
    return atrCaution
      ? `Core checks passed — TRADE with caution (${confidence}/100 score, reduced size).`
      : `All critical checks passed — TRADE (${confidence}/100 score).`;
  }
  return `Verdict: ${recommendation.toUpperCase()}.`;
}

/**
 * BTC Short Premium decision engine — Playbook v2.0 six-step output.
 * Pure function: no API calls, no order placement.
 */
export function runDecisionEngine(
  input: DecisionEngineInput,
): DecisionEngineOutput {
  const macroView = input.macroView ?? "neutral";
  const candidate = selectCandidate(input.optionCandidates);
  const missingData = detectMissingRequiredData(input);

  const combinationRead = evaluateCombinationRead(
    input.market,
    input.liquidation,
  );

  const noTradeRules = evaluateNoTradeRules(input.market, candidate, {
    macroEvent: input.macroEvent,
    liquidation: input.liquidation,
    macroView,
    technical4h: input.technical4h,
    consecutiveLosses: input.consecutiveLosses,
    priorDayRallyPct: input.priorDayRallyPct,
  });

  const hardSkip = hasHardNoTradeTrigger(noTradeRules);
  const liquidationCascade = isLiquidationCascadeTriggered(noTradeRules);
  const deltaRecommendation = resolveDeltaRecommendation(candidate);
  const atrCaution = isAtrCaution(noTradeRules);

  const checks = evaluateEightChecks(
    input.market,
    input.technicalDaily,
    input.technical4h,
    candidate,
    combinationRead,
    {
      macroEventBeforeSettlement: input.macroEvent.hasEventBeforeSettlement,
      macroView,
    },
  );

  const confidence = liquidationCascade
    ? HARD_RULE_CONFIDENCE
    : scoreChecks(checks);
  const coreCheckFailure = hasCoreCheckFailure(checks);
  const activeCautionCount = countActiveCautions(
    atrCaution,
    input.liquidation,
    checks,
  );

  let recommendation = resolveVerdict(
    hardSkip,
    missingData,
    combinationRead.pattern,
    deltaRecommendation,
    coreCheckFailure,
    atrCaution,
    activeCautionCount,
  );

  if (isAggressiveDeskRisk() && !hardSkip && missingData.length <= 1) {
    if (
      recommendation === "wait" &&
      deltaRecommendation === "wait" &&
      engineDeltaWaitAsTradeOk()
    ) {
      recommendation = "trade";
    }
    if (engineAllowsWaitAsTrade(recommendation, confidence)) {
      recommendation = "trade";
    }
    if (
      recommendation === "skip" &&
      engineAllowsCoreFailureTrade(coreCheckFailure, confidence)
    ) {
      recommendation = "trade";
    }
  }

  const caution =
    recommendation === "trade" &&
    (hasSoftCaution(noTradeRules) ||
      isLiquidationCaution(input.liquidation) ||
      atrCaution);

  const action =
    recommendation === "trade"
      ? resolveHypotheticalAction(macroView, "trade", candidate)
      : "no_trade";

  const slIndexPrice = computeSlIndexPrice(candidate);

  const suggestedSizePct =
    recommendation === "trade" ? (caution ? CAUTION_SIZE_PCT : FULL_SIZE_PCT) : 0;

  const analyzedAt = new Date().toISOString();

  const risks = [
    "BTC volatility can expand rapidly near 15:00 TH settlement.",
    "Short options carry undefined loss potential.",
    "Use Index Price for SL — never Mark Price.",
    ...(combinationRead.dataStatus === "partial_data"
      ? ["Combination Read incomplete — liquidation/OI data pending."]
      : []),
    ...(caution
      ? [
          atrCaution
            ? "Strike within 1.5× 4H ATR — reduced size or WAIT."
            : "Caution zone active — reduced hypothetical size.",
        ]
      : []),
  ];

  const actionPlan = {
    action,
    suggestedSizePct,
    entryNotes:
      liquidationCascade
        ? LIQUIDATION_CASCADE_ACTION
        : recommendation === "trade" && candidate
          ? `Hypothetical limit near bid $${candidate.bid.toFixed(0)} / mark $${candidate.markPrice.toFixed(0)} — |delta| ${Math.abs(candidate.delta).toFixed(2)}.`
          : recommendation === "wait"
            ? "WAIT — resolve caution flags or missing inputs before hypothetical entry."
            : "No hypothetical entry — SKIP.",
    exitNotes: `Hypothetical exit: 50–70% premium decay or forced pin exit ${PIN_EXIT_TIME_TH} TH (settlement ${SETTLEMENT_TIME_TH} TH).`,
    slIndexPrice,
    slMethod: "index_price" as const,
    pinExitTimeTh: PIN_EXIT_TIME_TH,
    settlementTimeTh: SETTLEMENT_TIME_TH,
    targetPremiumCapturePct: recommendation === "trade" ? 60 : 0,
    disclaimer: ANALYSIS_DISCLAIMER,
  };

  const verdict = {
    recommendation,
    confidence,
    summary: buildSummary(
      recommendation,
      confidence,
      hardSkip,
      liquidationCascade,
      missingData,
      coreCheckFailure,
      combinationRead.label,
      deltaRecommendation,
      atrCaution,
    ),
    candidate,
    risks,
    caution,
    missingData,
    analyzedAt,
  };

  return {
    step1_marketSnapshot: input.market,
    step2_eightCheckFramework: checks,
    step3_noTradeRules: noTradeRules,
    step4_combinationRead: combinationRead,
    step5_verdict: verdict,
    step6_actionPlan: actionPlan,
    optionCandidates: input.optionCandidates,
    technical: {
      daily: input.technicalDaily,
      h4: input.technical4h,
      h1: input.technical1h,
    },
    liquidation: input.liquidation,
    macroEvent: input.macroEvent,
  };
}
