import type { AutopilotMode, AutopilotSettings } from "./types";

export const AUTOPILOT_SETTINGS_KEY = "btc-desk:autopilot-settings";
export const AUTOPILOT_LAST_RUN_KEY = "btc-desk:autopilot-last-run";
export const AUTOPILOT_HISTORY_KEY = "btc-desk:autopilot-history";

export const AUTOPILOT_SAFETY_NOTICE =
  "Autopilot can run analysis and paper/shadow workflows only — live autopilot is locked and requires human approval.";

export const DEFAULT_AUTOPILOT_SETTINGS: AutopilotSettings = {
  autopilotEnabled: true,
  paperAutopilotEnabled: false,
  shadowModeEnabled: false,
  autoResolveEnabled: false,
  liveAutopilotEnabled: false,
  requireHumanApprovalForLive: true,
  mode: "ANALYSIS_ONLY",
  runIntervalMinutes: 15,
  maxPaperTradesPerDay: 3,
  maxShadowTradesPerDay: 5,
  lastRunAt: null,
  lastRunId: null,
  nextRunAt: null,
};

export const AUTOPILOT_MODE_LABELS: Record<AutopilotMode, string> = {
  OFF: "Off",
  ANALYSIS_ONLY: "Analysis only",
  PAPER_AUTOPILOT: "Paper autopilot",
  SHADOW_AUTOPILOT: "Shadow autopilot",
  LIVE_LOCKED: "Live locked",
};

export function resolveEffectiveMode(settings: AutopilotSettings): AutopilotMode {
  if (!settings.autopilotEnabled) return "OFF";
  if (settings.liveAutopilotEnabled) return "LIVE_LOCKED";
  if (settings.shadowModeEnabled) return "SHADOW_AUTOPILOT";
  if (settings.paperAutopilotEnabled) return "PAPER_AUTOPILOT";
  return settings.mode === "OFF" ? "OFF" : settings.mode;
}
