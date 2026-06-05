import type { AdaptiveWeightingSettings } from "./types";
import { DEFAULT_ADAPTIVE_WEIGHTING_SETTINGS } from "./types";

export const ADAPTIVE_WEIGHTING_SETTINGS_KEY =
  "btc-desk:adaptive-weighting-settings";

export function loadAdaptiveWeightingSettings(): AdaptiveWeightingSettings {
  if (typeof window === "undefined") return DEFAULT_ADAPTIVE_WEIGHTING_SETTINGS;
  try {
    const raw = localStorage.getItem(ADAPTIVE_WEIGHTING_SETTINGS_KEY);
    if (!raw) return DEFAULT_ADAPTIVE_WEIGHTING_SETTINGS;
    return { ...DEFAULT_ADAPTIVE_WEIGHTING_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ADAPTIVE_WEIGHTING_SETTINGS;
  }
}

export function saveAdaptiveWeightingSettings(
  patch: Partial<AdaptiveWeightingSettings>,
): AdaptiveWeightingSettings {
  const next = { ...loadAdaptiveWeightingSettings(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(ADAPTIVE_WEIGHTING_SETTINGS_KEY, JSON.stringify(next));
  }
  return next;
}
