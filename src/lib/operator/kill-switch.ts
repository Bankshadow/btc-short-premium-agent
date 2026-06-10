import { getEvents } from "@/lib/journal/journal-query";

export interface KillSwitchState {
  active: boolean;
  reason: string | null;
}

let journalCache: KillSwitchState | null = null;

function envKillSwitchOverride(): KillSwitchState | null {
  const raw = process.env.KILL_SWITCH_ACTIVE?.trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") {
    return {
      active: true,
      reason: process.env.KILL_SWITCH_REASON?.trim() || "Kill switch active (env)",
    };
  }
  return null;
}

export async function refreshKillSwitchFromJournal(): Promise<KillSwitchState> {
  const events = await getEvents();
  let active = false;
  let reason: string | null = null;

  for (const evt of [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    if (evt.type === "KILL_SWITCH_ENABLED") {
      active = true;
      reason = String((evt.payload as { reason?: string }).reason ?? "Operator enabled kill switch.");
    }
    if (evt.type === "KILL_SWITCH_DISABLED") {
      active = false;
      reason = null;
    }
  }

  journalCache = { active, reason };
  return journalCache;
}

export function getKillSwitchState(): KillSwitchState {
  const env = envKillSwitchOverride();
  if (env) return env;
  return journalCache ?? { active: false, reason: null };
}

export function setKillSwitchCache(state: KillSwitchState): void {
  journalCache = state;
}

export async function isKillSwitchActive(): Promise<boolean> {
  await refreshKillSwitchFromJournal();
  return getKillSwitchState().active;
}
