import { saveGovernanceState } from "@/lib/governance/governance-state";
import { saveKillSwitchState } from "@/lib/validation/kill-switch";
import { setPilotEmergencyStop } from "@/lib/live-pilot/journal-store";
import type { CommandCenterActionResult } from "./types";

/** Apply risk-reducing patches returned by POST /api/command-center/action (browser only). */
export function applyCommandCenterClientAction(
  result: CommandCenterActionResult,
): void {
  if (!result.ok || !result.clientMustPersist) return;

  if (result.killSwitchPatch) {
    saveKillSwitchState(result.killSwitchPatch);
  }

  if (result.governancePatch) {
    saveGovernanceState(result.governancePatch, {
      action: `command_center_${result.action.toLowerCase()}`,
      detail: result.message,
    });
  }

  if (result.pilotEmergencyStop) {
    setPilotEmergencyStop(true);
  }
}
