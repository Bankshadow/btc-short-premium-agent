import type { WorkspacePermission, WorkspaceRole } from "./types";

export const ALL_PERMISSIONS: WorkspacePermission[] = [
  "canRunAnalysis",
  "canEnablePaperAutopilot",
  "canApproveLiveTrade",
  "canChangeRiskSettings",
  "canManageApiKeys",
  "canViewReports",
  "canTriggerKillSwitch",
  "canApproveStrategyChanges",
  "canManageMembers",
  "canManageLiveSettings",
];

const ROLE_MATRIX: Record<WorkspaceRole, WorkspacePermission[]> = {
  OWNER: [...ALL_PERMISSIONS],
  ADMIN: [
    "canRunAnalysis",
    "canEnablePaperAutopilot",
    "canApproveLiveTrade",
    "canChangeRiskSettings",
    "canManageApiKeys",
    "canViewReports",
    "canApproveStrategyChanges",
    "canManageMembers",
    "canManageLiveSettings",
  ],
  TRADER: [
    "canRunAnalysis",
    "canEnablePaperAutopilot",
    "canApproveLiveTrade",
    "canViewReports",
  ],
  RISK_MANAGER: [
    "canRunAnalysis",
    "canChangeRiskSettings",
    "canViewReports",
    "canTriggerKillSwitch",
    "canApproveStrategyChanges",
  ],
  VIEWER: ["canViewReports"],
};

export function permissionsForRole(role: WorkspaceRole): Record<WorkspacePermission, boolean> {
  const allowed = new Set(ROLE_MATRIX[role]);
  return ALL_PERMISSIONS.reduce(
    (acc, p) => {
      acc[p] = allowed.has(p);
      return acc;
    },
    {} as Record<WorkspacePermission, boolean>,
  );
}

export function hasPermission(
  role: WorkspaceRole,
  permission: WorkspacePermission,
): boolean {
  return ROLE_MATRIX[role].includes(permission);
}

/** Map legacy governance OPERATOR role to platform TRADER. */
export function mapLegacyDeskRole(
  role: string,
): WorkspaceRole {
  if (role === "OPERATOR") return "TRADER";
  if (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "TRADER" ||
    role === "RISK_MANAGER" ||
    role === "VIEWER"
  ) {
    return role;
  }
  return "VIEWER";
}
