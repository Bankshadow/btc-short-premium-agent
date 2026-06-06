import type { AutopilotSettings } from "@/lib/autopilot/types";
import type { PaperAutopilotMode, PaperAutopilotSettings } from "./types";

export const PAPER_AUTOPILOT_STORAGE_KEY = "btc-desk:paper-autopilot-settings";
export const PAPER_LIFECYCLE_STORAGE_KEY = "btc-desk:paper-autopilot-lifecycle";

export const PAPER_AUTOPILOT_SAFETY_NOTICE =
  "Paper autopilot never calls live execution APIs. Shadow and demo trades are labeled separately. Live mode remains locked.";

export const PAPER_AUTOPILOT_MODE_LABELS: Record<PaperAutopilotMode, string> = {
  OFF: "Off",
  SHADOW_ONLY: "Shadow only",
  PAPER_ON_TRADE: "Paper on TRADE",
  PAPER_RELAXED: "Paper relaxed",
  PAPER_STRICT: "Paper strict",
};

export const PAPER_LIFECYCLE_STATUS_LABELS: Record<
  import("./types").PaperLifecycleStatus,
  string
> = {
  CREATED: "Created",
  OPEN: "Open",
  MONITORING: "Monitoring",
  CLOSE_RECOMMENDED: "Close recommended",
  CLOSED: "Closed",
  RESOLVED: "Resolved",
};

export const DEFAULT_PAPER_AUTOPILOT_SETTINGS: PaperAutopilotSettings = {
  mode: "OFF",
  autoResolveEnabled: false,
  autoCloseOnRecommendation: true,
  shadowMinConfidence: 65,
  stopLossPct: -2,
  takeProfitPct: 1.5,
  maxPaperTradesPerDay: 3,
  maxShadowTradesPerDay: 5,
  lastRunAt: null,
};

/** Map legacy autopilot toggles into paper-autopilot mode when unset. */
export function resolvePaperAutopilotModeFromAutopilot(
  autopilot: AutopilotSettings,
): PaperAutopilotMode {
  if (!autopilot.autopilotEnabled) return "OFF";
  if (autopilot.paperAutopilotEnabled && autopilot.shadowModeEnabled) {
    return "PAPER_RELAXED";
  }
  if (autopilot.paperAutopilotEnabled) return "PAPER_ON_TRADE";
  if (autopilot.shadowModeEnabled) return "SHADOW_ONLY";
  return "OFF";
}

export function paperModeAllowsPaperCreate(mode: PaperAutopilotMode): boolean {
  return (
    mode === "PAPER_ON_TRADE" ||
    mode === "PAPER_RELAXED" ||
    mode === "PAPER_STRICT"
  );
}

export function paperModeAllowsShadowCreate(mode: PaperAutopilotMode): boolean {
  return mode === "SHADOW_ONLY" || mode === "PAPER_RELAXED";
}
