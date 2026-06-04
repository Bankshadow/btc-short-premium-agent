import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { RegretMetrics } from "@/lib/mortem/types";

const EMPTY: RegretMetrics = {
  correctTrade: 0,
  falseTrade: 0,
  correctSkip: 0,
  falseSkip: 0,
  avoidedLossR: 0,
  missedOpportunityR: 0,
  regretScore: 0,
};

export function buildRegretMetrics(entries: DecisionLogEntry[]): RegretMetrics {
  const resolved = entries.filter((e) => e.outcomeStatus === "RESOLVED");
  if (resolved.length === 0) return EMPTY;
  return aggregateFromEntries(resolved);
}

function aggregateFromEntries(entries: DecisionLogEntry[]): RegretMetrics {
  let correctTrade = 0;
  let falseTrade = 0;
  let correctSkip = 0;
  let falseSkip = 0;
  let avoidedLossR = 0;
  let missedOpportunityR = 0;

  for (const e of entries) {
    const c = e.regretClassification;
    if (c === "CORRECT_TRADE") correctTrade += 1;
    else if (c === "FALSE_TRADE" || e.falseTradeFlag) falseTrade += 1;
    else if (
      c === "CORRECT_SKIP" ||
      c === "CORRECT_WAIT" ||
      c === "RISK_VETO_SAVED_LOSS"
    ) {
      correctSkip += 1;
      avoidedLossR += e.avoidedLossR ?? 0;
    } else if (
      c === "FALSE_SKIP" ||
      c === "MISSED_OPPORTUNITY" ||
      c === "RISK_VETO_TOO_CONSERVATIVE" ||
      e.falseSkipFlag
    ) {
      falseSkip += 1;
      missedOpportunityR += e.missedOpportunityR ?? 0;
    }
  }

  const total = correctTrade + falseTrade + correctSkip + falseSkip || 1;
  const regretScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        ((falseTrade + falseSkip * 0.7) / total) * 100 +
          missedOpportunityR * 2 -
          avoidedLossR * 1.5,
      ),
    ),
  );

  return {
    correctTrade,
    falseTrade,
    correctSkip,
    falseSkip,
    avoidedLossR: Number(avoidedLossR.toFixed(2)),
    missedOpportunityR: Number(missedOpportunityR.toFixed(2)),
    regretScore,
  };
}

export function riskVetoAccuracy(entries: DecisionLogEntry[]): {
  saved: number;
  tooConservative: number;
  total: number;
} {
  const resolved = entries.filter(
    (e) => e.outcomeStatus === "RESOLVED" && e.riskVeto,
  );
  return {
    saved: resolved.filter(
      (e) => e.regretClassification === "RISK_VETO_SAVED_LOSS",
    ).length,
    tooConservative: resolved.filter(
      (e) => e.regretClassification === "RISK_VETO_TOO_CONSERVATIVE",
    ).length,
    total: resolved.length,
  };
}
