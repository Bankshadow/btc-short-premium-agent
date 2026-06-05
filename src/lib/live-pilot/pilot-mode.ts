import { loadLivePilotRiskConfig } from "./pilot-config";
import type { LivePilotMode } from "./types";

export const PILOT_SAFETY_NOTICE =
  "Live pilot cannot enable itself. Default is LIVE_FULL_DISABLED_BY_DEFAULT. BTC options live is never available.";

export function resolveLivePilotMode(
  config = loadLivePilotRiskConfig(),
): LivePilotMode {
  if (!config.liveExecutionEnabled && !config.pilotEnabled) {
    return "LIVE_FULL_DISABLED_BY_DEFAULT";
  }

  if (!config.liveExecutionEnabled) {
    return "LIVE_DISABLED";
  }

  if (config.pilotEnabled) {
    return "LIVE_SMALL_PILOT";
  }

  if (config.network === "testnet") {
    return "LIVE_TESTNET";
  }

  return "LIVE_FULL_DISABLED_BY_DEFAULT";
}

export function pilotExecutionAllowed(mode: LivePilotMode): boolean {
  return mode === "LIVE_SMALL_PILOT" || mode === "LIVE_TESTNET";
}
