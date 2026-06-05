import type { AgentRecommendation } from "@/lib/agents/types";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";

export function applyHardConstraints(input: {
  weightedVerdict: AgentRecommendation;
  riskVeto: boolean;
  governance?: GovernanceAnalyzePayload | null;
  dataTrustCritical?: boolean;
  preMortemBlock?: boolean;
}): {
  finalVerdict: AgentRecommendation;
  hardGatesApplied: string[];
} {
  const gates: string[] = [];
  let verdict = input.weightedVerdict;

  if (input.riskVeto) {
    verdict = "SKIP";
    gates.push("Risk Manager veto — cannot be overridden");
  }

  if (input.governance?.hardRules?.locked) {
    const forced = input.governance.hardRules.forcedVerdict;
    verdict = forced;
    gates.push(
      `Governance hard rules: ${input.governance.hardRules.activeRules.join(", ")}`,
    );
  }

  if (input.governance?.safeMode && verdict === "TRADE") {
    verdict = "SKIP";
    gates.push("Governance safe mode — TRADE blocked");
  }

  if (input.dataTrustCritical) {
    if (verdict === "TRADE") {
      verdict = "SKIP";
    }
    gates.push("Data trust CRITICAL — TRADE blocked");
  }

  if (input.preMortemBlock) {
    if (verdict === "TRADE") {
      verdict = "SKIP";
    }
    gates.push("Pre-mortem BLOCK — TRADE blocked");
  }

  return { finalVerdict: verdict, hardGatesApplied: gates };
}
