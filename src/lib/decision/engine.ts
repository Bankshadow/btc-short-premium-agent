import type {
  DecisionEngineInput,
  DecisionEngineOutput,
  OptionCandidate,
  TradeRecommendation,
} from "@/lib/types/market";
import {
  evaluateCombinationRead,
  isLiquidationCaution,
} from "./combination-read";
import {
  evaluateNoTradeRules,
  hasHardNoTradeTrigger,
  hasSoftCaution,
} from "./no-trade-rules";
import {
  allCriticalChecksPass,
  computeSlIndexPrice,
  evaluateEightChecks,
  resolveHypotheticalAction,
  scoreChecks,
} from "./rules";

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

function resolveVerdict(
  hardSkip: boolean,
  missingData: string[],
  checksPass: boolean,
  combinationPattern: string,
): TradeRecommendation {
  if (hardSkip) return "skip";
  if (missingData.length > 0) return "wait";
  if (combinationPattern === "long_capitulation") return "skip";
  if (!checksPass) return "skip";
  return "trade";
}

function buildSummary(
  recommendation: TradeRecommendation,
  confidence: number,
  hardSkip: boolean,
  missingData: string[],
  checksPass: boolean,
  combinationReadLabel: string,
): string {
  if (hardSkip) return "Hard No-Trade Rule triggered — SKIP.";
  if (missingData.length > 0) {
    return `Required data missing (${missingData.join(", ")}) — WAIT.`;
  }
  if (combinationReadLabel.includes("Long Capitulation")) {
    return "Combination Read: Long Capitulation — SKIP.";
  }
  if (!checksPass) {
    return `Critical checks not passed — SKIP (${confidence}/100 score).`;
  }
  return `All critical checks passed — TRADE (${confidence}/100 score).`;
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
    consecutiveLosses: input.consecutiveLosses,
    priorDayRallyPct: input.priorDayRallyPct,
  });

  const hardSkip = hasHardNoTradeTrigger(noTradeRules);
  const caution =
    hasSoftCaution(noTradeRules) || isLiquidationCaution(input.liquidation);

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

  const confidence = scoreChecks(checks);
  const checksPass = allCriticalChecksPass(checks);

  const recommendation = resolveVerdict(
    hardSkip,
    missingData,
    checksPass,
    combinationRead.pattern,
  );

  const action = resolveHypotheticalAction(
    macroView,
    recommendation,
    candidate,
  );
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
    ...(caution ? ["Liquidation in CAUTION zone ($50M–$200M) — reduced size."] : []),
  ];

  const actionPlan = {
    action,
    suggestedSizePct,
    entryNotes:
      recommendation === "trade" && candidate
        ? `Hypothetical limit near bid $${candidate.bid.toFixed(0)} / mark $${candidate.markPrice.toFixed(0)} — |delta| ${Math.abs(candidate.delta).toFixed(2)}.`
        : recommendation === "wait"
          ? "WAIT — resolve missing inputs before hypothetical entry."
          : "No hypothetical entry — SKIP.",
    exitNotes: `Hypothetical exit: 50–70% premium decay or forced pin exit ${PIN_EXIT_TIME_TH} TH (settlement ${SETTLEMENT_TIME_TH} TH).`,
    slIndexPrice,
    slMethod: "index_price" as const,
    pinExitTimeTh: PIN_EXIT_TIME_TH,
    settlementTimeTh: SETTLEMENT_TIME_TH,
    targetPremiumCapturePct: 60,
    disclaimer: ANALYSIS_DISCLAIMER,
  };

  const verdict = {
    recommendation,
    confidence,
    summary: buildSummary(
      recommendation,
      confidence,
      hardSkip,
      missingData,
      checksPass,
      combinationRead.label,
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
