import type { GovernanceDeskState } from "@/lib/governance/governance-types";
import type { HardRuleLockResult } from "@/lib/governance/governance-types";
import { DESK_MANAGER_SAFETY_NOTICE } from "./types";

export interface SafetyGateResult {
  allowed: boolean;
  blockReason?: string;
  notices: string[];
}

export function checkSafetyGates(input: {
  governance?: GovernanceDeskState;
  hardRules?: HardRuleLockResult;
}): SafetyGateResult {
  const notices = [DESK_MANAGER_SAFETY_NOTICE];

  if (input.governance?.pauseAnalysis) {
    return {
      allowed: false,
      blockReason: "Analysis paused by governance — desk manager cycle skipped.",
      notices,
    };
  }

  notices.push("Manager cannot place live trades or auto-approve proposals.");
  notices.push("Manager cannot disable kill switch or increase live risk.");

  if (input.hardRules?.locked) {
    notices.push(
      `Hard rules active: ${input.hardRules.activeRules.join(", ")} — escalations only.`,
    );
  }

  return { allowed: true, notices };
}
