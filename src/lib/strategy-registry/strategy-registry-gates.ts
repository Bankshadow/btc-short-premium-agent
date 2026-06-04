import type { AgentOutput } from "@/lib/agents/types";
import type { StrategyId } from "@/lib/validation/validation-types";
import { classifyFuturesDirection } from "@/lib/validation/classify-strategy";
import { AGENT_TO_STRATEGY_IDS } from "./strategy-registry-config";
import type {
  StrategyRegistryAnalyzePayload,
  StrategyRegistryStatus,
} from "./strategy-registry-types";
import { registryMapFromPayload } from "./build-strategy-registry";

export function isStrategyProposingBlocked(
  status: StrategyRegistryStatus,
): boolean {
  return status === "DISABLED" || status === "DEPRECATED";
}

export function isLiveTradeTicketBlocked(
  status: StrategyRegistryStatus,
): boolean {
  return (
    isStrategyProposingBlocked(status) ||
    status === "PAPER_TESTING" ||
    status === "DRAFT" ||
    status === "WATCHLIST"
  );
}

function worstStatus(
  statuses: StrategyRegistryStatus[],
): StrategyRegistryStatus {
  const rank: Record<StrategyRegistryStatus, number> = {
    DISABLED: 0,
    DEPRECATED: 1,
    DRAFT: 2,
    WATCHLIST: 3,
    PAPER_TESTING: 4,
    ACTIVE: 5,
  };
  return statuses.reduce((a, b) => (rank[a] <= rank[b] ? a : b));
}

export function strategyIdsForAgent(
  agent: AgentOutput,
): StrategyId[] {
  const mapped = AGENT_TO_STRATEGY_IDS[agent.agentName];
  if (!mapped) return [];
  if (agent.agentName === "Futures Strategy Agent" && agent.recommendation === "TRADE") {
    const dir = classifyFuturesDirection(agent);
    if (dir) return [dir];
    return mapped;
  }
  return mapped;
}

export function applyRegistryGateToAgent(
  agent: AgentOutput,
  statusMap: Map<StrategyId, StrategyRegistryStatus>,
): AgentOutput {
  const ids = strategyIdsForAgent(agent);
  if (ids.length === 0) return agent;

  const statuses = ids.map((id) => statusMap.get(id) ?? "WATCHLIST");
  const status = worstStatus(statuses);

  if (isStrategyProposingBlocked(status)) {
    return {
      ...agent,
      recommendation: "SKIP",
      reasons: [
        `Strategy registry: ${status} — ${ids.join(", ")} cannot propose TRADE.`,
        ...agent.reasons,
      ],
    };
  }

  if (status === "DRAFT" && agent.recommendation === "TRADE") {
    return {
      ...agent,
      recommendation: "WAIT",
      reasons: [
        `Strategy registry: DRAFT — ${ids[0]} not cleared for committee TRADE.`,
        ...agent.reasons,
      ],
    };
  }

  return agent;
}

export function applyRegistryToStrategyAgents(input: {
  spot: AgentOutput;
  futures: AgentOutput;
  options: AgentOutput;
  payload?: StrategyRegistryAnalyzePayload | null;
}): {
  spot: AgentOutput;
  futures: AgentOutput;
  options: AgentOutput;
} {
  const statusMap = registryMapFromPayload(input.payload);
  return {
    spot: applyRegistryGateToAgent(input.spot, statusMap),
    futures: applyRegistryGateToAgent(input.futures, statusMap),
    options: applyRegistryGateToAgent(input.options, statusMap),
  };
}

export function primaryStrategyBlockedForTicket(
  strategyIds: StrategyId[],
  payload?: StrategyRegistryAnalyzePayload | null,
): { blocked: boolean; reason: string | null } {
  const statusMap = registryMapFromPayload(payload);
  for (const id of strategyIds) {
    const status = statusMap.get(id);
    if (status && isLiveTradeTicketBlocked(status)) {
      return {
        blocked: true,
        reason: `Strategy ${id} is ${status} — trade tickets blocked (paper-only path may still apply).`,
      };
    }
  }
  return { blocked: false, reason: null };
}
