import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { OutcomeClassification } from "@/lib/review/outcome-classifier";

export function detectFalseSkip(
  entry: DecisionLogEntry,
  classification: OutcomeClassification,
): { flag: boolean; missedOpportunityR: number } {
  const falseSkip =
    classification === "FALSE_SKIP" ||
    classification === "MISSED_OPPORTUNITY" ||
    classification === "RISK_VETO_TOO_CONSERVATIVE";

  if (!falseSkip) {
    return { flag: false, missedOpportunityR: 0 };
  }

  const move =
    entry.resolution && entry.btcPrice > 0
      ? Math.abs(
          ((entry.resolution.btcPriceAfter - entry.btcPrice) / entry.btcPrice) *
            100,
        )
      : 0;
  const missedR = Number(Math.min(2.5, 0.35 + move * 0.12).toFixed(2));
  return { flag: true, missedOpportunityR: missedR };
}
