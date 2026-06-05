import { effectivePilotMaxNotional, loadLivePilotRiskConfig } from "./pilot-config";
import { computePilotDailyMetrics } from "./pilot-metrics";
import { PILOT_SAFETY_NOTICE, pilotExecutionAllowed, resolveLivePilotMode } from "./pilot-mode";
import type { LiveTradeJournalEntry, PilotStatusSnapshot } from "./types";

export function buildPilotStatusSnapshot(
  journal: LiveTradeJournalEntry[],
  emergencyStopActive = false,
): PilotStatusSnapshot {
  const config = loadLivePilotRiskConfig();
  const mode = resolveLivePilotMode(config);
  const metrics = computePilotDailyMetrics(journal, config);

  const openTrades = journal.filter((j) => j.status === "OPEN" || j.status === "EXECUTED");
  const closedTrades = journal.filter((j) => j.status === "CLOSED");

  return {
    mode,
    config,
    metrics,
    emergencyStopActive: emergencyStopActive || config.emergencyStopEnv,
    btcOptionsLiveSupported: false,
    safetyNotice: PILOT_SAFETY_NOTICE,
    openTrades,
    closedTrades,
    effectiveMaxNotionalUsd: effectivePilotMaxNotional(config),
    executionAllowed: pilotExecutionAllowed(mode),
  };
}
