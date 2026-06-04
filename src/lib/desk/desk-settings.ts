export const DESK_SETTINGS_STORAGE_KEY =
  "trading-agents-crypto-desk:desk-settings";

export interface DeskCloudSettings {
  syncJournalSupabase: boolean;
}

export const DEFAULT_DESK_SETTINGS: DeskCloudSettings = {
  syncJournalSupabase: true,
};

export function loadDeskSettings(): DeskCloudSettings {
  if (typeof window === "undefined") return DEFAULT_DESK_SETTINGS;
  try {
    const raw = localStorage.getItem(DESK_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_DESK_SETTINGS;
    return { ...DEFAULT_DESK_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_DESK_SETTINGS;
  }
}

export function saveDeskSettings(settings: DeskCloudSettings): DeskCloudSettings {
  if (typeof window === "undefined") return settings;
  localStorage.setItem(DESK_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  return settings;
}
