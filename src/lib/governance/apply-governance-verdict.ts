import type { AgentRecommendation, CommitteeVerdict } from "@/lib/agents/types";
import type { GovernanceAnalyzePayload } from "./governance-types";
import { hardRuleSummary } from "./hard-rule-lock";

export function applyGovernanceToVerdict(
  verdict: CommitteeVerdict,
  governance?: GovernanceAnalyzePayload | null,
): CommitteeVerdict {
  if (!governance) return verdict;

  let finalVerdict: AgentRecommendation = verdict.finalVerdict;
  const disagreementNotes = [...verdict.disagreementNotes];
  const topReasons = [...verdict.topReasons];

  if (governance.hardRules.locked) {
    finalVerdict = governance.hardRules.forcedVerdict;
    disagreementNotes.push(
      `Hard rule lock: ${hardRuleSummary(governance.hardRules.activeRules)} — cannot override.`,
    );
    topReasons.unshift(governance.hardRules.messages[0] ?? "Hard rule lock active.");
  }

  if (governance.safeMode && finalVerdict === "TRADE") {
    finalVerdict = verdict.riskVeto ? "SKIP" : "WAIT";
    disagreementNotes.push(
      "Safe mode: all TRADE verdicts forced to WAIT/SKIP — no semi-live path.",
    );
  }

  if (governance.disableAggressiveMode && finalVerdict === "TRADE") {
    disagreementNotes.push("Aggressive mode disabled by governance.");
  }

  let consensusSummary = verdict.consensusSummary;
  if (governance.safeMode && finalVerdict !== "TRADE") {
    consensusSummary =
      "Safe mode active — desk will not emit TRADE until governance clears.";
  } else if (governance.hardRules.locked) {
    consensusSummary = `Hard rule lock — forced ${finalVerdict}. Operator override not permitted.`;
  }

  return {
    ...verdict,
    finalVerdict,
    consensusSummary,
    topReasons: [...new Set(topReasons)].slice(0, 3),
    disagreementNotes,
    finalActionPlan:
      finalVerdict === "TRADE"
        ? verdict.finalActionPlan
        : finalVerdict === "SKIP"
          ? verdict.finalActionPlan ||
            "Governance block — no hypothetical orders."
          : "Governance WAIT — refresh data or clear kill switch.",
  };
}
