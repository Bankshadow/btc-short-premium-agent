import type { AgentCritique, AgentProposal } from "./collaboration-types";
import type { ScenarioContextReference } from "@/lib/analysis/scenario-context";
import type { RegimeClassification } from "@/lib/regime/regime-types";

export function createAgentCritiques(input: {
  proposals: AgentProposal[];
  scenario: ScenarioContextReference | null;
  regime: RegimeClassification;
}): AgentCritique[] {
  const now = new Date().toISOString();
  const critiques: AgentCritique[] = [];

  critiques.push({
    agentId: "risk-manager",
    role: "Risk Manager",
    targetAgentId: "market-analyst",
    critique: "All proposals must pass risk gate and no-trade rules before TRADE.",
    severity: "WARN",
    createdAt: now,
  });

  if (input.regime.regime === "UNKNOWN") {
    critiques.push({
      agentId: "risk-manager",
      role: "Risk Manager",
      targetAgentId: "market-analyst",
      critique: "Regime UNKNOWN — reduce confidence and prefer WAIT.",
      severity: "WARN",
      createdAt: now,
    });
  }

  critiques.push({
    agentId: "execution-skeptic",
    role: "Skeptic Agent",
    targetAgentId: "market-analyst",
    critique: "Mock analysis signal may not reflect live market conditions.",
    severity: "INFO",
    createdAt: now,
  });

  if (input.scenario?.advisorySignal === "RISK_OFF") {
    critiques.push({
      agentId: "risk-manager",
      role: "Risk Manager",
      targetAgentId: "swarm-reporter",
      critique: "Swarm RISK_OFF — disagree with aggressive TRADE proposals.",
      severity: "BLOCK",
      createdAt: now,
    });
  }

  return critiques;
}

export function extractDissent(critiques: AgentCritique[]): string[] {
  return critiques
    .filter((c) => c.severity === "BLOCK" || c.severity === "WARN")
    .map((c) => `${c.role}: ${c.critique}`);
}
