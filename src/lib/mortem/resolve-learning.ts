import type { DecisionLogEntry, ResolveOutcomeInput } from "@/lib/journal/decision-log-types";
import { classifyResolvedOutcome, lessonTagsForClassification } from "@/lib/review/outcome-classifier";
import { detectFalseTrade } from "@/lib/regret/false-trade-detector";
import { detectFalseSkip } from "@/lib/regret/false-skip-detector";
import { runLossAutopsyAgent } from "./loss-autopsy-agent";
import { createDraftRuleFromAutopsy } from "./mortem-draft-rules";
import { createIncident } from "@/lib/governance/incidents-store";

export function enrichResolvedEntry(
  entry: DecisionLogEntry,
  resolution: ResolveOutcomeInput,
): DecisionLogEntry {
  const classification = classifyResolvedOutcome(entry, {
    ...resolution,
    resolvedAt: new Date().toISOString(),
  });

  const falseTrade = detectFalseTrade(entry, classification);
  const falseSkip = detectFalseSkip(entry, classification);

  let avoidedLossR = 0;
  if (
    classification === "CORRECT_SKIP" ||
    classification === "RISK_VETO_SAVED_LOSS" ||
    classification === "CORRECT_WAIT"
  ) {
    avoidedLossR = Number(
      Math.abs(entry.paperPnl ?? 0.35).toFixed(2),
    );
  }

  const autopsy = runLossAutopsyAgent({
    entry,
    resolution: {
      ...resolution,
      resolvedAt: new Date().toISOString(),
    },
    classification,
    preMortem: entry.preMortem,
    learningSnapshot: entry.learningSnapshot,
  });

  let lessonTags = lessonTagsForClassification(classification);
  if (autopsy) {
    lessonTags = [...lessonTags, `loss-${autopsy.lossType.toLowerCase()}`];
  }

  const enriched: DecisionLogEntry = {
    ...entry,
    regretClassification: classification,
    falseTradeFlag: falseTrade.flag,
    falseSkipFlag: falseSkip.flag,
    missedOpportunityR: falseSkip.missedOpportunityR,
    avoidedLossR: falseTrade.flag ? 0 : avoidedLossR,
    lessonTags,
    autopsy: autopsy ?? entry.autopsy ?? null,
  };

  if (autopsy?.draftRuleSuggestion && autopsy.lossType !== "EXPECTED_LOSS") {
    createDraftRuleFromAutopsy(entry.id, autopsy);
  }

  if (autopsy?.incidentCandidate && typeof window !== "undefined") {
    createIncident({
      type: "risk_breach",
      severity: "medium",
      description: autopsy.rootCause,
      affectedDecisionId: entry.id,
      rootCause: autopsy.rootCause,
      correctiveAction: autopsy.preventionSuggestion,
    });
  }

  return enriched;
}
