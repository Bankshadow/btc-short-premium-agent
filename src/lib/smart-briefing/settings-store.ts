import {
  DEFAULT_SMART_BRIEFING_SETTINGS,
  SMART_BRIEFING_SETTINGS_KEY,
} from "./config";
import type { SmartBriefingSettings } from "./types";

export function loadSmartBriefingSettings(): SmartBriefingSettings {
  if (typeof window === "undefined") return DEFAULT_SMART_BRIEFING_SETTINGS;
  try {
    const raw = localStorage.getItem(SMART_BRIEFING_SETTINGS_KEY);
    if (!raw) return DEFAULT_SMART_BRIEFING_SETTINGS;
    return {
      ...DEFAULT_SMART_BRIEFING_SETTINGS,
      ...(JSON.parse(raw) as Partial<SmartBriefingSettings>),
    };
  } catch {
    return DEFAULT_SMART_BRIEFING_SETTINGS;
  }
}

export function saveSmartBriefingSettings(
  patch: Partial<SmartBriefingSettings>,
): SmartBriefingSettings {
  const next = { ...loadSmartBriefingSettings(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(SMART_BRIEFING_SETTINGS_KEY, JSON.stringify(next));
  }
  return next;
}
