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
  operatorRole: "OPERATOR",
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

export function loadGovernanceState(): GovernanceDeskState {
  if (typeof window === "undefined") {
    return { ...DEFAULT_GOVERNANCE_STATE, ...mergeKillSwitch(DEFAULT_KILL_SWITCH_STATE) };
  }
  try {
    const raw = localStorage.getItem(GOVERNANCE_STORAGE_KEY);
    const kill = loadKillSwitchState();
    if (!raw) {
      return { ...DEFAULT_GOVERNANCE_STATE, ...mergeKillSwitch(kill) };
    }
    return {
      ...DEFAULT_GOVERNANCE_STATE,
      ...mergeKillSwitch(kill),
      ...(JSON.parse(raw) as Partial<GovernanceDeskState>),
    };
  } catch {
    return {
      ...DEFAULT_GOVERNANCE_STATE,
      ...mergeKillSwitch(loadKillSwitchState()),
    };
  }
}

export function saveGovernanceState(
  patch: Partial<GovernanceDeskState>,
  audit?: { action: string; detail: string },
): GovernanceDeskState {
  const prev = loadGovernanceState();
  const next = { ...prev, ...patch };

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
      localStorage.setItem(KILL_SWITCH_STORAGE_KEY, JSON.stringify(merged));
    }

    const { operatorPaused, operatorPauseReason, operatorPausedAt, cooldownUntil, ...rest } =
      next;
    void operatorPaused;
    void operatorPauseReason;
    void operatorPausedAt;
    void cooldownUntil;
    localStorage.setItem(GOVERNANCE_STORAGE_KEY, JSON.stringify(rest));
  }

  if (audit) {
    appendGovernanceAudit({
      action: audit.action,
      detail: audit.detail,
      actorName: next.operatorName,
      actorRole: next.operatorRole,
    });
  }

  return next;
}

export function setOperatorIdentity(name: string, role: DeskUserRole): GovernanceDeskState {
  return saveGovernanceState(
    { operatorName: name, operatorRole: role },
    { action: "operator_identity", detail: `${role}: ${name}` },
  );
}
