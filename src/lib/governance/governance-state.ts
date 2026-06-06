import { getActiveWorkspaceId, getCurrentMemberRole, getCurrentUser } from "@/lib/platform/workspace-registry";
import { mapLegacyDeskRole } from "@/lib/platform/permissions";
import { readScopedJson, writeScopedJson } from "@/lib/platform/scoped-storage";
import {
  DEFAULT_KILL_SWITCH_STATE,
  KILL_SWITCH_STORAGE_KEY,
  loadKillSwitchState,
  type KillSwitchPersistedState,
} from "@/lib/validation/kill-switch";
import type { DeskUserRole, GovernanceDeskState } from "./governance-types";
import { appendGovernanceAudit } from "./governance-audit-log";

export const GOVERNANCE_STORAGE_KEY =
  "trading-agents-crypto-desk:governance-desk-state";

export const DEFAULT_GOVERNANCE_STATE: GovernanceDeskState = {
  pauseAnalysis: false,
  pausePaperAutoOpen: false,
  disableAggressiveMode: false,
  disableAlerts: false,
  safeMode: false,
  operatorPaused: false,
  operatorPauseReason: "",
  operatorPausedAt: null,
  cooldownUntil: null,
  operatorRole: "TRADER",
  operatorName: "Desk Operator",
};

function mergeKillSwitch(
  kill: KillSwitchPersistedState,
): Pick<
  GovernanceDeskState,
  "operatorPaused" | "operatorPauseReason" | "operatorPausedAt" | "cooldownUntil"
> {
  return {
    operatorPaused: kill.operatorPaused,
    operatorPauseReason: kill.operatorPauseReason,
    operatorPausedAt: kill.operatorPausedAt,
    cooldownUntil: kill.cooldownUntil,
  };
}

function platformOperatorDefaults(): Pick<GovernanceDeskState, "operatorName" | "operatorRole" | "workspaceId"> {
  const role = getCurrentMemberRole();
  const user = getCurrentUser();
  return {
    workspaceId: getActiveWorkspaceId(),
    operatorName: user.displayName,
    operatorRole: role,
  };
}

export function loadGovernanceState(): GovernanceDeskState {
  if (typeof window === "undefined") {
    return { ...DEFAULT_GOVERNANCE_STATE, ...mergeKillSwitch(DEFAULT_KILL_SWITCH_STATE) };
  }
  try {
    const kill = loadKillSwitchState();
    const stored = readScopedJson<Partial<GovernanceDeskState>>("governance", {});
    const platform = platformOperatorDefaults();
    return {
      ...DEFAULT_GOVERNANCE_STATE,
      ...mergeKillSwitch(kill),
      ...stored,
      workspaceId: platform.workspaceId,
      operatorName: stored.operatorName ?? platform.operatorName,
      operatorRole: mapLegacyDeskRole(
        String(stored.operatorRole ?? platform.operatorRole),
      ) as DeskUserRole,
    };
  } catch {
    return {
      ...DEFAULT_GOVERNANCE_STATE,
      ...mergeKillSwitch(loadKillSwitchState()),
      ...platformOperatorDefaults(),
    };
  }
}

export function saveGovernanceState(
  patch: Partial<GovernanceDeskState>,
  audit?: { action: string; detail: string },
): GovernanceDeskState {
  const prev = loadGovernanceState();
  const next = {
    ...prev,
    ...patch,
    workspaceId: getActiveWorkspaceId(),
  };

  if (typeof window !== "undefined") {
    const killPatch: Partial<KillSwitchPersistedState> = {};
    if (patch.operatorPaused !== undefined) {
      killPatch.operatorPaused = patch.operatorPaused;
    }
    if (patch.operatorPauseReason !== undefined) {
      killPatch.operatorPauseReason = patch.operatorPauseReason;
    }
    if (patch.operatorPausedAt !== undefined) {
      killPatch.operatorPausedAt = patch.operatorPausedAt;
    }
    if (patch.cooldownUntil !== undefined) {
      killPatch.cooldownUntil = patch.cooldownUntil;
    }
    if (Object.keys(killPatch).length > 0) {
      const merged = { ...loadKillSwitchState(), ...killPatch };
      writeScopedJson("kill-switch", merged);
    }

    const { operatorPaused, operatorPauseReason, operatorPausedAt, cooldownUntil, ...rest } =
      next;
    void operatorPaused;
    void operatorPauseReason;
    void operatorPausedAt;
    void cooldownUntil;
    writeScopedJson("governance", rest);
  }

  if (audit) {
    const auditEntries = appendGovernanceAudit({
      action: audit.action,
      detail: audit.detail,
      actorName: next.operatorName,
      actorRole: next.operatorRole,
    });
    if (typeof window !== "undefined") {
      void fetch("/api/db/migrate-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ governanceAudit: auditEntries.slice(0, 5) }),
      }).catch(() => undefined);
    }
  }

  return next;
}

export function setOperatorIdentity(name: string, role: DeskUserRole): GovernanceDeskState {
  return saveGovernanceState(
    { operatorName: name, operatorRole: role },
    { action: "operator_identity", detail: `${role}: ${name}` },
  );
}
