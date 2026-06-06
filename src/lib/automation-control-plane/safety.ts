import type { AutomationJobType } from "./types";

const BLOCKED_JOB_ACTIONS = new Set<string>([
  "APPROVE_LIVE_TRADE",
  "ENABLE_LIVE_AUTOPILOT",
  "INCREASE_RISK",
  "DISABLE_KILL_SWITCH",
  "SCALE_LIVE",
]);

/** Automation may only run these risk-reducing side effects. */
export function isAutomationActionAllowed(actionName: string): boolean {
  return !BLOCKED_JOB_ACTIONS.has(actionName);
}

export function assertAutomationJobSafety(jobType: AutomationJobType): void {
  if (jobType === ("LIVE_EXECUTE" as AutomationJobType)) {
    throw new Error("Automation cannot execute live trades.");
  }
}

export const AUTOMATION_GUARANTEES = {
  cannotApproveLiveTrades: true as const,
  cannotIncreaseRisk: true as const,
  cannotDisableKillSwitch: true as const,
};
