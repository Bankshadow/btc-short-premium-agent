import { saveDeskSettings } from "@/lib/desk/desk-settings";
import { saveGovernanceState } from "@/lib/governance/governance-state";
import { loadPaperSettings, savePaperSettings } from "@/lib/paper/paper-orders";
import { saveTradeControlSettings } from "@/lib/trade-control/trade-control-settings";
import { getDeskProfile } from "./desk-profiles";
import { resolveModeEffects } from "./environment-modes";
import { applyTradingOsRuntime } from "./trading-os-runtime";
import type {
  DeskProfileId,
  EnvironmentMode,
  WorkspaceConfig,
} from "./trading-os-types";

export const WORKSPACE_STORAGE_KEY =
  "trading-agents-crypto-desk:workspace-config";

export const DEFAULT_WORKSPACE: WorkspaceConfig = {
  activeProfileId: "btc_options_desk",
  environmentMode: "SEMI_LIVE",
  viewMode: "private",
  updatedAt: new Date(0).toISOString(),
};

export function loadWorkspaceConfig(): WorkspaceConfig {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE;
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return DEFAULT_WORKSPACE;
    return { ...DEFAULT_WORKSPACE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_WORKSPACE;
  }
}

export function saveWorkspaceConfig(
  patch: Partial<WorkspaceConfig>,
): WorkspaceConfig {
  const next = {
    ...loadWorkspaceConfig(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(next));
  }
  applyWorkspaceSideEffects(next);
  return next;
}

/** Apply profile + environment mode to desk subsystems (client only). */
export function applyWorkspaceSideEffects(config?: WorkspaceConfig): void {
  const ws = config ?? loadWorkspaceConfig();
  const profile = getDeskProfile(ws.activeProfileId);
  const effects = resolveModeEffects(ws.environmentMode, ws.activeProfileId);

  applyTradingOsRuntime(effects);

  saveDeskSettings({ riskProfile: profile.defaultRiskProfile });
  saveTradeControlSettings({
    humanApprovalRequired: effects.requireHumanApproval,
  });
  savePaperSettings({
    ...loadPaperSettings(),
    autoOpenOnTrade: effects.allowPaperAutoOpen,
  });
  if (effects.forceGovernanceSafeMode) {
    saveGovernanceState({ safeMode: true });
  }
}

export function setActiveProfile(profileId: DeskProfileId): WorkspaceConfig {
  const profile = getDeskProfile(profileId);
  return saveWorkspaceConfig({
    activeProfileId: profileId,
    environmentMode: profile.defaultEnvironmentMode,
  });
}

export function setEnvironmentMode(mode: EnvironmentMode): WorkspaceConfig {
  return saveWorkspaceConfig({ environmentMode: mode });
}
