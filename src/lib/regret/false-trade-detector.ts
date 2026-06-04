import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { OutcomeClassification } from "@/lib/review/outcome-classifier";

export function detectFalseTrade(
  entry: DecisionLogEntry,
  classification: OutcomeClassification,
): { flag: boolean } {
  if (classification !== "FALSE_TRADE") {
    return { flag: false };
  }
  return { flag: true };
}
