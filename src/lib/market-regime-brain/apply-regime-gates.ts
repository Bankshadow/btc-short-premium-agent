import type { AgentOutput } from "@/lib/agents/types";
import type { StrategyId } from "@/lib/validation/validation-types";
import { strategyIdsForAgent } from "@/lib/strategy-registry/strategy-registry-gates";
import type { RegimeBrainResult } from "./types";

export function applyRegimeBrainGateToAgent(
  agent: AgentOutput,
  brain: RegimeBrainResult,
): AgentOutput {
  const ids = strategyIdsForAgent(agent);
  if (ids.length === 0) return agent;

  const blocked = ids.filter((id) => brain.blockedStrategies.includes(id));
  if (blocked.length === 0) return agent;

  const allBlocked = ids.every((id) => brain.blockedStrategies.includes(id));
  if (!allBlocked) return agent;

  return {
    ...agent,
    recommendation: brain.tradeFrequencyRecommendation === "PAUSE" ? "SKIP" : "WAIT",
    reasons: [
      `Regime Brain (${brain.primaryRegime}): ${blocked.join(", ")} blocked for current regime.`,
      ...agent.reasons,
    ],
  };
}

export function applyRegimeBrainToStrategyAgents(input: {
  spot: AgentOutput;
  futures: AgentOutput;
  options: AgentOutput;
  brain: RegimeBrainResult;
}): {
  spot: AgentOutput;
  futures: AgentOutput;
  options: AgentOutput;
} {
  return {
    spot: applyRegimeBrainGateToAgent(input.spot, input.brain),
    futures: applyRegimeBrainGateToAgent(input.futures, input.brain),
    options: applyRegimeBrainGateToAgent(input.options, input.brain),
  };
}

export function regimeContextBullets(brain: RegimeBrainResult): string[] {
  return [
    `Regime Brain: ${brain.primaryRegime} (${brain.regimeConfidence}% confidence)`,
    `Routing: recommend ${brain.recommendedStrategies.join(", ") || "none"}`,
    brain.blockedStrategies.length
      ? `Blocked: ${brain.blockedStrategies.join(", ")}`
      : "No strategies blocked by regime",
    `Sizing ×${brain.sizingMultiplier} · frequency ${brain.tradeFrequencyRecommendation}`,
  ];
}

export function isStrategyRecommendedByBrain(
  strategyId: StrategyId,
  brain: RegimeBrainResult,
): boolean {
  if (brain.blockedStrategies.includes(strategyId)) return false;
  return brain.recommendedStrategies.includes(strategyId);
}
