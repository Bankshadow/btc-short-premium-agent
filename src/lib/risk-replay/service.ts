import { resolveRiskReplayTradeInput } from "./data-source";
import { runRiskReplaySimulation } from "./engine";
import type { RiskReplayReport } from "./types";

export async function runRiskReplayForTradeId(
  tradeId: string,
): Promise<RiskReplayReport | null> {
  const tradeInput = await resolveRiskReplayTradeInput(tradeId);
  if (!tradeInput) return null;
  return runRiskReplaySimulation(tradeInput);
}
