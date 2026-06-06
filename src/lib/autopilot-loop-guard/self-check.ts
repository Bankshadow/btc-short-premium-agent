import type { LoopGuardDecision, LoopGuardMetrics } from "./types";

export function runLoopGuardSelfCheck(metrics: LoopGuardMetrics): string {
  const lines = [
    "Autopilot self-check — reviewing recent desk actions.",
    `Risk level: ${metrics.loopRiskLevel}.`,
    `Action diversity: ${(metrics.actionDiversity * 100).toFixed(0)}% (${metrics.uniqueActionKeys}/${metrics.totalActions} unique).`,
    `Success rate: ${(metrics.successRate * 100).toFixed(0)}% · repeated failures: ${metrics.repeatedFailureCount}.`,
  ];

  if (metrics.maxSameActionRepeats >= 3) {
    lines.push(
      `Same action repeated ${metrics.maxSameActionRepeats}× — consider changing strategy or pausing.`,
    );
  }
  if (metrics.staleMarketContextCycles >= 4) {
    lines.push(
      `Market context unchanged for ${metrics.staleMarketContextCycles} cycles — analysis may be redundant.`,
    );
  }
  if (metrics.duplicatePreviewAttempts > 0 || metrics.duplicateOrderAttempts > 0) {
    lines.push("Duplicate trade attempts detected — execution path needs operator review.");
  }
  if (metrics.reasons.length > 0) {
    lines.push(`Signals: ${metrics.reasons.slice(0, 3).join("; ")}`);
  }

  lines.push("Recommendation: approve only if you expect new market information or a deliberate retry.");
  return lines.join(" ");
}

export function attachSelfCheckToDecision(
  decision: LoopGuardDecision,
): LoopGuardDecision {
  if (!decision.requiresSelfCheck) return decision;
  const summary = runLoopGuardSelfCheck(decision.metrics);
  return { ...decision, selfCheckSummary: summary };
}
