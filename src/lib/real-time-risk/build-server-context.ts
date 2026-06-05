import { buildExchangeStatus } from "@/lib/exchange/build-exchange-status";
import type { RealTimeRiskInput } from "./types";

/** Enrich client risk input with server exchange snapshot. */
export async function enrichRealTimeRiskInput(
  client: Partial<RealTimeRiskInput>,
): Promise<RealTimeRiskInput> {
  let exchangePositions = client.exchangePositions;
  let openOrders = client.openOrders;
  let wallet = client.wallet;

  try {
    const ex = await buildExchangeStatus();
    if (ex.connected) {
      exchangePositions = [
        ...(ex.linearPositions ?? []),
        ...(ex.optionPositions ?? []),
      ];
      openOrders = [
        ...(ex.openLinearOrders ?? []),
        ...(ex.openOptionOrders ?? []),
      ];
      wallet = ex.wallet;
    }
  } catch {
    /* use client payload */
  }

  return {
    entries: client.entries ?? [],
    orders: client.orders ?? [],
    perpPositions: client.perpPositions,
    liveTrades: client.liveTrades,
    exchangePositions,
    openOrders,
    wallet: wallet ?? null,
    portfolio: client.portfolio ?? null,
    market: client.market ?? null,
    regimeBrain: client.regimeBrain ?? null,
    governance: client.governance,
    incidents: client.incidents,
    riskBudget: client.riskBudget ?? null,
    commandCenter: client.commandCenter ?? null,
    emergencyStopActive: client.emergencyStopActive,
    dailyPnlPct: client.dailyPnlPct,
    weeklyPnlPct: client.weeklyPnlPct,
    pilotDailyLossUsd: client.pilotDailyLossUsd,
    pilotWeeklyLossUsd: client.pilotWeeklyLossUsd,
  };
}
