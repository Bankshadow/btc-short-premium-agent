import type { JournalEvent } from "@/lib/journal/journal-types";

export interface RiskProjection {
  portfolioBlocksExecution: boolean;
  operatorKillSwitch: boolean;
  enginePaused: boolean;
  openPositions: number;
}

export function buildRiskProjection(events: JournalEvent[]): RiskProjection {
  const killOn = events.some(
    (e) =>
      e.type === "KILL_SWITCH_ENABLED" &&
      !events.some(
        (off) =>
          off.type === "KILL_SWITCH_DISABLED" && off.timestamp.localeCompare(e.timestamp) > 0,
      ),
  );
  const paused = events.some(
    (e) =>
      e.type === "ENGINE_PAUSED" &&
      !events.some(
        (r) => r.type === "ENGINE_RESUMED" && r.timestamp.localeCompare(e.timestamp) > 0,
      ),
  );
  const opened = new Set(
    events.filter((e) => e.type === "ORDER_EXECUTED").map((e) => e.tradeId).filter(Boolean),
  );
  const closed = new Set(
    events.filter((e) => e.type === "POSITION_CLOSED").map((e) => e.tradeId).filter(Boolean),
  );
  let openPositions = 0;
  for (const id of opened) {
    if (id && !closed.has(id)) openPositions += 1;
  }
  const portfolioBlocked = events.some(
    (e) => e.type === "PORTFOLIO_RISK_BLOCKED" || e.type === "STATE_HEALTH_BLOCKED",
  );
  return {
    portfolioBlocksExecution: portfolioBlocked,
    operatorKillSwitch: killOn,
    enginePaused: paused,
    openPositions,
  };
}

export function zeroRiskProjection(): RiskProjection {
  return {
    portfolioBlocksExecution: false,
    operatorKillSwitch: false,
    enginePaused: false,
    openPositions: 0,
  };
}
