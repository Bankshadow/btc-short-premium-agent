import type { MissionSnapshot } from "@/lib/mission/mission-types";
import type { ScenarioSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-types";
import type { RegimeClassification, RegimeTag } from "./regime-types";

export function classifyRegime(input: {
  mission: MissionSnapshot;
  swarmReport: ScenarioSwarmReport | null;
}): RegimeClassification {
  const reasons: string[] = [];
  let regime: RegimeTag = "UNKNOWN";
  let confidence = 0.4;

  const swarm = input.swarmReport;
  if (swarm?.advisorySignal === "RISK_OFF" || swarm?.recommendedAction === "REDUCE_RISK") {
    regime = "RISK_OFF";
    confidence = 0.72;
    reasons.push("Swarm advisory RISK_OFF or REDUCE_RISK.");
  } else if (swarm?.liquidityTrapRisk.toLowerCase().includes("trap")) {
    regime = "LIQUIDITY_TRAP";
    confidence = 0.65;
    reasons.push("Swarm flagged liquidity trap risk.");
  } else if (swarm?.volatilityRisk.toLowerCase().includes("high")) {
    regime = "HIGH_VOLATILITY";
    confidence = 0.68;
    reasons.push("Swarm flagged elevated volatility.");
  } else if (input.mission.netPnl > 0 && input.mission.win > input.mission.loss) {
    regime = "TRENDING_UP";
    confidence = 0.55;
    reasons.push("Positive equity trend with more wins than losses.");
  } else if (input.mission.netPnl < 0 && input.mission.loss > input.mission.win) {
    regime = "TRENDING_DOWN";
    confidence = 0.55;
    reasons.push("Negative equity trend with more losses than wins.");
  } else if (input.mission.totalTrades >= 2 && Math.abs(input.mission.netPnl) < 5) {
    regime = "RANGE";
    confidence = 0.5;
    reasons.push("Flat net PnL across closed trades suggests range-bound conditions.");
  } else if (input.mission.totalTrades === 0) {
    regime = "UNKNOWN";
    confidence = 0.3;
    reasons.push("No closed trades — regime classification uncertain.");
  } else {
    regime = "LOW_VOLATILITY";
    confidence = 0.45;
    reasons.push("Default low-volatility read from limited evidence.");
  }

  return {
    regime,
    confidence,
    reasons,
    classifiedAt: new Date().toISOString(),
  };
}
