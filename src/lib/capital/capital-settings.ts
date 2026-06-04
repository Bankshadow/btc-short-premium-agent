export interface CapitalMissionSettings {
  /** Mission starting equity (simulation base) */
  missionStartUsd: number;
  /** When false, use manualEquityUsd for stage tracking */
  useSimulatedEquity: boolean;
  manualEquityUsd: number;
}

export const CAPITAL_SETTINGS_STORAGE_KEY =
  "trading-agents-crypto-desk:capital-mission-settings";

export const DEFAULT_CAPITAL_SETTINGS: CapitalMissionSettings = {
  missionStartUsd: 1_000,
  useSimulatedEquity: true,
  manualEquityUsd: 1_000,
};

export function loadCapitalSettings(): CapitalMissionSettings {
  if (typeof window === "undefined") return DEFAULT_CAPITAL_SETTINGS;
  try {
    const raw = localStorage.getItem(CAPITAL_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_CAPITAL_SETTINGS;
    return { ...DEFAULT_CAPITAL_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CAPITAL_SETTINGS;
  }
}

export function saveCapitalSettings(
  patch: Partial<CapitalMissionSettings>,
): CapitalMissionSettings {
  const next = { ...loadCapitalSettings(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(CAPITAL_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
