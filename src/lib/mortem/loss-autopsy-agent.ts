import type { DecisionLogEntry, PaperResolution } from "@/lib/journal/decision-log-types";
import type { LossAutopsyResult, LossType, LearningSnapshot } from "./types";
import type { PreMortemResult } from "./types";
import type { OutcomeClassification } from "@/lib/review/outcome-classifier";

export interface LossAutopsyInput {
  entry: DecisionLogEntry;
  resolution: PaperResolution;
  classification: OutcomeClassification;
  preMortem?: PreMortemResult | null;
  learningSnapshot?: LearningSnapshot | null;
}

export function runLossAutopsyAgent(input: LossAutopsyInput): LossAutopsyResult | null {
  const { entry, resolution, classification } = input;
  const isLoss =
    classification === "FALSE_TRADE" ||
    (entry.finalVerdict === "TRADE" &&
      (resolution.tradeWouldWin === false ||
        (entry.paperPnl != null && entry.paperPnl < 0)));

  if (!isLoss) return null;

  const contributingFactors: string[] = [];
  const agentMistakes: string[] = [];
  const ruleFailures: string[] = [];
  let lossType: LossType = "UNKNOWN";
  let incidentCandidate = false;

  if (entry.operatorOverride) {
    lossType = "OPERATOR_OVERRIDE_LOSS";
    contributingFactors.push(
      `Operator disagreed with ${entry.operatorOverride.originalVerdict ?? "desk"}: ${entry.operatorOverride.reason}`,
    );
  }

  const snap = input.learningSnapshot;
  if (snap && (snap.dataTrustGrade === "LOW" || snap.dataTrustGrade === "CRITICAL")) {
    lossType = lossType === "UNKNOWN" ? "DATA_FAILURE" : lossType;
    contributingFactors.push(
      `Entry data trust ${snap.dataTrustGrade} (${snap.dataTrustScore}/100).`,
    );
  }

  if (snap && snap.conflictLevel === "HIGH") {
    contributingFactors.push(`Conflict score ${snap.conflictScore} at entry.`);
  }

  if (input.preMortem?.preMortemVerdict === "CAUTION" || input.preMortem?.preMortemVerdict === "PASS") {
    if (input.preMortem.failureScenarios[0]) {
      contributingFactors.push(`Pre-mortem warned: ${input.preMortem.topFailureReason}`);
    }
  } else if (input.preMortem?.preMortemVerdict === "BLOCK") {
    contributingFactors.push("Pre-mortem BLOCK was overridden or bypassed.");
    ruleFailures.push("Trade proceeded despite pre-mortem BLOCK.");
    incidentCandidate = true;
  }

  for (const agent of entry.agentOutputs) {
    if (agent.recommendation === "TRADE" && resolution.tradeWouldWin === false) {
      agentMistakes.push(
        `${agent.agentName} (${agent.confidence}) backed TRADE into a loss.`,
      );
    }
  }

  if (entry.riskVeto && entry.finalVerdict === "TRADE") {
    ruleFailures.push("Risk veto was active but TRADE still recorded.");
    lossType = "RULE_VIOLATION";
    incidentCandidate = true;
  } else if (!entry.riskVeto && resolution.tradeWouldWin === false) {
    const risk = entry.agentOutputs.find((a) => a.strategyType === "RISK");
    if (risk?.recommendation === "TRADE" && !risk.veto) {
      lossType = "RISK_MANAGER_MISSED";
      agentMistakes.push("Risk Manager did not veto a losing TRADE setup.");
    }
  }

  const regimeMismatch = entry.marketRegime.toLowerCase().includes("volatile");
  if (regimeMismatch && entry.finalVerdict === "TRADE") {
    contributingFactors.push(`Regime ${entry.marketRegime} may have been misread.`);
    if (lossType === "UNKNOWN") lossType = "BAD_REGIME_DETECTION";
  }

  const highConfTrade = entry.agentOutputs.filter(
    (a) => a.recommendation === "TRADE" && a.confidence === "HIGH",
  );
  if (highConfTrade.length >= 2 && resolution.tradeWouldWin === false) {
    lossType = lossType === "UNKNOWN" ? "OVERCONFIDENCE" : lossType;
    contributingFactors.push("Multiple HIGH-confidence TRADE agents on a losing outcome.");
  }

  if (
    lossType === "UNKNOWN" &&
    resolution.notes.toLowerCase().includes("expected")
  ) {
    lossType = "EXPECTED_LOSS";
  }

  if (ruleFailures.length > 0 && lossType === "UNKNOWN") {
    lossType = "RULE_VIOLATION";
    incidentCandidate = true;
  }

  const rootCause =
    lossType === "DATA_FAILURE"
      ? "Decision relied on incomplete or stale market data."
      : lossType === "OVERCONFIDENCE"
        ? "Desk overweighted agent conviction vs tape quality."
        : lossType === "RULE_VIOLATION"
          ? "Hard or soft risk rule was violated or bypassed."
          : lossType === "OPERATOR_OVERRIDE_LOSS"
            ? "Human override diverged from risk-aligned verdict."
            : lossType === "RISK_MANAGER_MISSED"
              ? "Risk Manager failed to veto a losing TRADE."
              : lossType === "BAD_REGIME_DETECTION"
                ? "Regime label did not match realized price action."
                : lossType === "EXPECTED_LOSS"
                  ? "Loss within playbook variance — no new rule required."
                  : "Short premium thesis invalidated before target decay.";

  let preventionSuggestion =
    "Re-run pre-mortem before next TRADE; require HIGH data trust and LOW conflict.";
  let draftRuleSuggestion: string | undefined;

  if (lossType === "EXPECTED_LOSS") {
    preventionSuggestion =
      "Log as variance — do not auto-create rules; review size and invalidation only.";
    draftRuleSuggestion = undefined;
  } else if (lossType === "RULE_VIOLATION") {
    preventionSuggestion =
      "Open governance incident review; block semi-live ticket until resolved.";
    draftRuleSuggestion =
      "Draft: No TRADE ticket when pre-mortem BLOCK or risk veto is active.";
    incidentCandidate = true;
  } else if (lossType === "DATA_FAILURE") {
    preventionSuggestion =
      "Fill manual overrides or wait for live tape; downgrade trust for affected sources.";
    draftRuleSuggestion =
      "Draft: WAIT when data trust grade is LOW or CRITICAL on required fields.";
  } else if (lossType === "OVERCONFIDENCE") {
    preventionSuggestion =
      "Require Risk Manager TRADE approval when ≥2 agents HIGH vs conflict MEDIUM+.";
    draftRuleSuggestion =
      "Draft: Cap position size when agent disagreement score > 40.";
  } else {
    draftRuleSuggestion = `Draft: ${rootCause.slice(0, 80)} — paper retest required.`;
  }

  return {
    autopsyId: `la-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    lossType,
    rootCause,
    contributingFactors: contributingFactors.slice(0, 6),
    agentMistakes: agentMistakes.slice(0, 5),
    ruleFailures: ruleFailures.slice(0, 4),
    preventionSuggestion,
    draftRuleSuggestion,
    incidentCandidate,
    generatedAt: new Date().toISOString(),
  };
}
