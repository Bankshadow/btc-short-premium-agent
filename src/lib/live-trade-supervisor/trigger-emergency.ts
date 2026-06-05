import { LIVE_SUPERVISOR_SAFETY_NOTICE } from "./types";

export interface EmergencyTriggerResult {
  pilotEmergencyStop: boolean;
  governanceKillSwitch: boolean;
  autoCloseTriggered: false;
  operatorNote: string;
  safetyNotice: string;
}

/** Server-side acknowledgment — client persists pilot stop + governance kill switch. */
export function buildEmergencyTriggerResponse(input: {
  operatorNote?: string;
  triggerGovernanceKillSwitch?: boolean;
}): EmergencyTriggerResult {
  return {
    pilotEmergencyStop: true,
    governanceKillSwitch: input.triggerGovernanceKillSwitch !== false,
    autoCloseTriggered: false,
    operatorNote:
      input.operatorNote?.trim() ||
      "Supervisor emergency — human-initiated stop.",
    safetyNotice: `${LIVE_SUPERVISOR_SAFETY_NOTICE} Emergency auto-close is disabled by default.`,
  };
}
