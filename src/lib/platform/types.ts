import type { DeskProfileId, DeskViewMode } from "@/lib/trading-os/trading-os-types";

export type WorkspaceRole =
  | "OWNER"
  | "ADMIN"
  | "TRADER"
  | "RISK_MANAGER"
  | "VIEWER";

export type TradingEnvironment =
  | "DEMO"
  | "PAPER"
  | "TESTNET"
  | "LIVE_LOCKED"
  | "LIVE_ENABLED";

export type WorkspacePermission =
  | "canRunAnalysis"
  | "canEnablePaperAutopilot"
  | "canApproveLiveTrade"
  | "canChangeRiskSettings"
  | "canManageApiKeys"
  | "canViewReports"
  | "canTriggerKillSwitch"
  | "canApproveStrategyChanges"
  | "canManageMembers"
  | "canManageLiveSettings";

export interface PlatformUser {
  id: string;
  displayName: string;
  email: string | null;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceFeatureFlags {
  paperAutopilot: boolean;
  livePilot: boolean;
  optionsTestnet: boolean;
  backgroundWorker: boolean;
  strategyExperiments: boolean;
}

export interface WorkspaceSettings {
  workspaceId: string;
  tradingEnvironment: TradingEnvironment;
  activeProfileId: DeskProfileId;
  viewMode: DeskViewMode;
  featureFlags: WorkspaceFeatureFlags;
  updatedAt: string;
}

export interface PlatformRegistry {
  version: 1;
  currentUserId: string;
  activeWorkspaceId: string;
  users: PlatformUser[];
  workspaces: Workspace[];
  members: WorkspaceMember[];
  settingsByWorkspace: Record<string, WorkspaceSettings>;
}

export interface WorkspaceContextPayload {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  permissions: Record<WorkspacePermission, boolean>;
  settings: WorkspaceSettings;
  workspace: Workspace;
  user: PlatformUser;
}

export const DEFAULT_FEATURE_FLAGS: WorkspaceFeatureFlags = {
  paperAutopilot: true,
  livePilot: true,
  optionsTestnet: true,
  backgroundWorker: true,
  strategyExperiments: true,
};

export const DEFAULT_WORKSPACE_SETTINGS = (
  workspaceId: string,
): WorkspaceSettings => ({
  workspaceId,
  tradingEnvironment: "PAPER",
  activeProfileId: "btc_options_desk",
  viewMode: "private",
  featureFlags: { ...DEFAULT_FEATURE_FLAGS },
  updatedAt: new Date().toISOString(),
});
