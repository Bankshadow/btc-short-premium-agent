import type { AgentProposal } from "./collaboration-types";
import type { ScenarioContextReference } from "@/lib/analysis/scenario-context";
import type { MissionSnapshot } from "@/lib/mission/mission-types";
import type { RegimeClassification } from "@/lib/regime/regime-types";

export function createAgentProposals(input: {
  mission: MissionSnapshot;
  scenario: ScenarioContextReference | null;
  regime: RegimeClassification;
}): AgentProposal[] {
  const now = new Date().toISOString();

  const marketAnalyst: AgentProposal = {
    agentId: "market-analyst",
    role: "Market Analyst",
    proposal:
      input.mission.netPnl >= 0
        ? "Equity stable — cautious testnet short premium setup may be considered."
        : "Drawdown present — prefer WAIT until evidence improves.",
    confidence: 0.58,
    createdAt: now,
  };

  const swarmReporter: AgentProposal = {
    agentId: "swarm-reporter",
    role: "MiroFish Swarm Reporter",
    proposal: input.scenario
      ? `Scenario: ${input.scenario.likelyScenario} (${input.scenario.advisorySignal}).`
      : "No swarm report — scenario context unavailable.",
    confidence: input.scenario?.confidence ?? 0.4,
    createdAt: now,
  };

  return [marketAnalyst, swarmReporter];
}

export function createExecutionProposal(mission: MissionSnapshot): AgentProposal {
  return {
    agentId: "execution-specialist",
    role: "Execution Specialist",
    proposal:
      mission.openPositions > 0
        ? "Open position exists — no new entry until flat."
        : "Testnet execution feasible if preview and safety gate pass.",
    confidence: 0.65,
    createdAt: new Date().toISOString(),
  };
}

export function createLearningProposal(lessons: string[]): AgentProposal {
  return {
    agentId: "learning-agent",
    role: "Learning Agent",
    proposal:
      lessons.length > 0
        ? `Past lessons: ${lessons.slice(0, 2).join("; ")}`
        : "No relevant past lessons retrieved.",
    confidence: 0.55,
    createdAt: new Date().toISOString(),
  };
}
