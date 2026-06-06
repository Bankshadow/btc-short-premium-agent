import {
  DEFAULT_PAPER_AUTOPILOT_SETTINGS,
  PAPER_AUTOPILOT_STORAGE_KEY,
} from "./config";
import type { PaperAutopilotSettings } from "./types";

export function loadPaperAutopilotSettings(): PaperAutopilotSettings {
  if (typeof window === "undefined") return DEFAULT_PAPER_AUTOPILOT_SETTINGS;
  try {
    const raw = localStorage.getItem(PAPER_AUTOPILOT_STORAGE_KEY);
    if (!raw) return DEFAULT_PAPER_AUTOPILOT_SETTINGS;
    return {
      ...DEFAULT_PAPER_AUTOPILOT_SETTINGS,
      ...(JSON.parse(raw) as Partial<PaperAutopilotSettings>),
    };
  } catch {
    return DEFAULT_PAPER_AUTOPILOT_SETTINGS;
  }
}

export function savePaperAutopilotSettings(
  patch: Partial<PaperAutopilotSettings>,
): PaperAutopilotSettings {
  const next = { ...loadPaperAutopilotSettings(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(PAPER_AUTOPILOT_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
