import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { loadGovernanceState } from "./governance-state";
import { evaluateHardRuleLocks } from "./hard-rule-lock";
import type { GovernanceAnalyzePayload } from "./governance-types";
import { loadWorkspaceConfig } from "@/lib/trading-os/workspace-store";
import { resolveModeEffects } from "@/lib/trading-os/environment-modes";

export function buildGovernancePayloadForAnalyze(input?: {
  data?: AnalyzeApiResponse | null;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  riskProfile?: DeskRiskProfile;
}): GovernanceAnalyzePayload {
  const state = loadGovernanceState();
  const ws = loadWorkspaceConfig();
  const modeEffects = resolveModeEffects(ws.environmentMode, ws.activeProfileId);
  const hardRules = evaluateHardRuleLocks({
    data: input?.data ?? null,
    entries: input?.entries ?? [],
    orders: input?.orders ?? [],
    riskProfile: input?.riskProfile ?? "balanced",
  });

  return {
    safeMode: state.safeMode || modeEffects.forceGovernanceSafeMode,
    disableAggressiveMode: state.disableAggressiveMode,
    pauseAnalysis: state.pauseAnalysis,
    hardRules,
  };
}
