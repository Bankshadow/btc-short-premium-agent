import { hasPermission } from "@/lib/platform/permissions";
import type { WorkspaceRole } from "@/lib/platform/types";
import type { PolicyActionType } from "./types";

const ACTION_PERMISSION: Partial<
  Record<PolicyActionType, import("@/lib/platform/types").WorkspacePermission>
> = {
  RUN_ANALYSIS: "canRunAnalysis",
  CREATE_PAPER_TRADE: "canEnablePaperAutopilot",
  CREATE_SHADOW_TRADE: "canEnablePaperAutopilot",
  PREVIEW_LIVE_ORDER: "canApproveLiveTrade",
  EXECUTE_LIVE_PERP: "canApproveLiveTrade",
  EXECUTE_OPTIONS_TESTNET: "canApproveLiveTrade",
  EXECUTE_OPTIONS_LIVE: "canApproveLiveTrade",
  CHANGE_RISK_PROFILE: "canChangeRiskSettings",
  APPROVE_STRATEGY_CHANGE: "canApproveStrategyChanges",
  ENABLE_AUTOPILOT: "canEnablePaperAutopilot",
  TRIGGER_KILL_SWITCH: "canTriggerKillSwitch",
  PROMOTE_LIVE_STAGE: "canManageLiveSettings",
};

export function permissionForAction(
  action: PolicyActionType,
): import("@/lib/platform/types").WorkspacePermission | null {
  return ACTION_PERMISSION[action] ?? null;
}

export function roleAllowsAction(
  role: WorkspaceRole,
  action: PolicyActionType,
): boolean {
  const perm = permissionForAction(action);
  if (!perm) return true;
  return hasPermission(role, perm);
}
