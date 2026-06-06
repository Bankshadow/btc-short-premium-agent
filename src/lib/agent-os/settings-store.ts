import {
  DEFAULT_AGENT_OS_SETTINGS,
  type AgentOsSettings,
} from "./types";

export const AGENT_OS_SETTINGS_KEY = "btc-desk:agent-os-settings";

export function loadAgentOsSettings(): AgentOsSettings {
  if (typeof window === "undefined") return { ...DEFAULT_AGENT_OS_SETTINGS };
  try {
    const raw = localStorage.getItem(AGENT_OS_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AGENT_OS_SETTINGS };
    return { ...DEFAULT_AGENT_OS_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_AGENT_OS_SETTINGS };
  }
}

export function saveAgentOsSettings(patch: Partial<AgentOsSettings>): AgentOsSettings {
  const next = { ...loadAgentOsSettings(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(AGENT_OS_SETTINGS_KEY, JSON.stringify(next));
  }
  return next;
}
