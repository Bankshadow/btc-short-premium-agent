import type { AnalyzeApiResponse } from "@/lib/types/market";

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatVerdictLabel(recommendation: string): string {
  return recommendation.toUpperCase();
}

function collectKeyReasons(analysis: AnalyzeApiResponse): string[] {
  const reasons: string[] = [];

  for (const rule of analysis.step3_noTradeRules) {
    if (rule.triggered) {
      reasons.push(rule.message);
    }
  }

  for (const check of analysis.step2_eightCheckFramework) {
    if (check.status === "fail") {
      reasons.push(check.message);
    }
  }

  const { missingData } = analysis.step5_verdict;
  if (missingData.length > 0) {
    reasons.push(`Missing data: ${missingData.join(", ")}`);
  }

  const combo = analysis.step4_combinationRead;
  if (
    combo.pattern === "long_capitulation" ||
    (combo.pattern === "partial_data" && combo.dataStatus === "partial_data")
  ) {
    const comboLine = `${combo.label} — ${combo.actionHint}`;
    if (!reasons.some((reason) => reason.includes(combo.label))) {
      reasons.push(comboLine);
    }
  }

  if (reasons.length === 0) {
    reasons.push(analysis.step5_verdict.summary);
  }

  return reasons.slice(0, 6);
}

function formatCandidateLine(analysis: AnalyzeApiResponse): string {
  const candidate = analysis.step5_verdict.candidate;
  if (!candidate) {
    return "Candidate strike: N/A";
  }

  const typeLabel = candidate.optionType === "call" ? "Call" : "Put";
  return `Candidate strike: ${formatUsd(candidate.strike)} ${typeLabel} · exp ${candidate.expiry} · |Δ| ${Math.abs(candidate.delta).toFixed(2)}`;
}

function formatSlLine(analysis: AnalyzeApiResponse): string {
  const { slIndexPrice } = analysis.step6_actionPlan;
  if (slIndexPrice <= 0) {
    return "SL (Index Price): N/A";
  }
  return `SL (Index Price): ${formatUsd(slIndexPrice)} (strike ±500)`;
}

function formatForcedExitLine(analysis: AnalyzeApiResponse): string {
  const { pinExitTimeTh, settlementTimeTh } = analysis.step6_actionPlan;
  return `Forced exit: ${pinExitTimeTh} TH · settlement ${settlementTimeTh} TH`;
}

/**
 * Builds a concise Telegram alert from the latest analysis output.
 */
export function formatAnalysisNotification(analysis: AnalyzeApiResponse): string {
  const { recommendation, confidence } = analysis.step5_verdict;
  const reasons = collectKeyReasons(analysis);
  const spot = analysis.step1_marketSnapshot.spotPrice;

  const lines = [
    "BTC Short Premium — Analysis Only",
    "",
    `Verdict: ${formatVerdictLabel(recommendation)} (${confidence}/100)`,
    spot > 0 ? `BTC spot: ${formatUsd(spot)}` : null,
    "",
    "Key reasons:",
    ...reasons.map((reason) => `• ${reason}`),
    "",
    formatCandidateLine(analysis),
    formatSlLine(analysis),
    formatForcedExitLine(analysis),
    "",
    "Hypothetical analysis only — no real orders sent.",
  ];

  return lines.filter((line) => line != null).join("\n");
}
