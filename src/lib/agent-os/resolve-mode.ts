import type { AgentOsMode, AgentOsModeInput } from "./types";

/**
 * Resolves the highest active operating mode for the trading agent.
 * LIVE_LOCKED is always enforced separately for live actions.
 */
export function resolveAgentOsMode(input: AgentOsModeInput = {}): AgentOsMode {
  if (input.observeOnly) return "OBSERVE";

  if (
    input.testnetAllowAllSafe &&
    input.testnetAllowAllExplicitlyEnabled &&
    input.testnetConnected
  ) {
    return "TESTNET_ALLOW_ALL_SAFE";
  }

  if (input.testnetConnected && input.automationEnabled !== false) {
    return "TESTNET_ASSISTED";
  }

  if (input.paperAutopilotEnabled || input.shadowModeEnabled) {
    return "PAPER_AUTOPILOT";
  }

  if (input.autopilotEnabled !== false) {
    return "ANALYZE";
  }

  return "OBSERVE";
}
