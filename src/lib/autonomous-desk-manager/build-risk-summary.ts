import type { DeskAutomationResult } from "@/lib/automation/automation-types";
import type { GovernanceDeskState } from "@/lib/governance/governance-types";
import type { HardRuleLockResult } from "@/lib/governance/governance-types";
import type { RiskSummary } from "./types";

export function buildRiskSummary(input: {
  governance?: GovernanceDeskState;
  hardRules?: HardRuleLockResult;
  automation?: DeskAutomationResult | null;
}): RiskSummary {
  const notes: string[] = [];
  let escalationLevel: RiskSummary["escalationLevel"] = "NONE";

  const safeMode = input.governance?.safeMode ?? false;
  const pauseAnalysis = input.governance?.pauseAnalysis ?? false;
  const hardRulesLocked = input.hardRules?.locked ?? false;
  const activeHardRules = input.hardRules?.activeRules ?? [];

  if (safeMode) {
    escalationLevel = "ELEVATED";
    notes.push("Governance safe mode is ON.");
  }
  if (input.governance?.operatorPaused) {
    escalationLevel = "ELEVATED";
    notes.push("Operator pause / kill switch active.");
  }
  if (hardRulesLocked) {
    escalationLevel = "CRITICAL";
    notes.push(`Hard rule lock: ${activeHardRules.join(", ")}`);
  }

  const validation = input.automation?.validation;
  if (validation?.killSwitch?.tradingPaused) {
    escalationLevel = "CRITICAL";
    notes.push("Validation kill switch active.");
  } else if ((validation?.disableNext.length ?? 0) > 0) {
    if (escalationLevel === "NONE") escalationLevel = "WATCH";
    notes.push(`${validation!.disableNext.length} strategy disable recommendation(s).`);
  }

  const war = input.automation?.warRoom;
  if (war?.recommendedAction.toLowerCase().includes("safe mode")) {
    escalationLevel = "ELEVATED";
    notes.push(`War room: ${war.recommendedAction}`);
  }

  const analyze = input.automation?.analyze;
  if (analyze?.dataTrust?.grade === "CRITICAL") {
    escalationLevel = "CRITICAL";
    notes.push("Data trust grade CRITICAL on latest analyze.");
  }

  if (notes.length === 0) {
    notes.push("No elevated risk flags in this cycle.");
  }

  return {
    safeMode,
    pauseAnalysis,
    hardRulesLocked,
    activeHardRules,
    escalationLevel,
    notes,
  };
}
