import type { AgentOutput } from "@/lib/agents/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { StrategyId } from "./validation-types";

export function classifyFuturesDirection(agent: AgentOutput): StrategyId | null {
  if (agent.strategyType !== "FUTURES" || agent.recommendation !== "TRADE") {
    return null;
  }
  const text = `${agent.proposedAction} ${agent.reasons.join(" ")}`.toLowerCase();
  if (text.includes("short")) return "futures_short";
  if (text.includes("long")) return "futures_long";
  return "futures_short";
}

export function strategiesSignaledOnEntry(entry: DecisionLogEntry): StrategyId[] {
  const set = new Set<StrategyId>();

  for (const agent of entry.agentOutputs) {
    if (agent.recommendation !== "TRADE") continue;
    if (agent.agentName === "Options Strategy Agent") {
      set.add("options_short_premium");
    } else if (agent.agentName === "Spot Strategy Agent") {
      set.add("spot");
    } else if (agent.agentName === "Futures Strategy Agent") {
      const dir = classifyFuturesDirection(agent);
      if (dir) set.add(dir);
    }
  }

  const researchText = [
    ...(entry.replaySnapshot?.researchBullets ?? []),
    ...entry.topReasons,
  ]
    .join(" ")
    .toLowerCase();
  if (researchText.includes("eth") || researchText.includes("btc/eth")) {
    set.add("eth_btc");
  }

  if (entry.deskRiskProfile === "aggressive" && entry.finalVerdict === "TRADE") {
    set.add("aggressive_risk_mode");
  }

  return [...set];
}

export function primaryStrategyForPaper(
  instrument: string,
  side: string,
): StrategyId {
  if (instrument === "sell_call" || instrument === "sell_put") {
    return "options_short_premium";
  }
  if (side === "short") return "futures_short";
  if (side === "long") return "spot";
  return "options_short_premium";
}

export function riskProfileFromEntry(
  entry: DecisionLogEntry,
  fallback: DeskRiskProfile,
): DeskRiskProfile {
  return entry.deskRiskProfile ?? fallback;
}
