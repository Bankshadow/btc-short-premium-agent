import {
  AUTOPILOT_HISTORY_KEY,
  AUTOPILOT_LAST_RUN_KEY,
  AUTOPILOT_SETTINGS_KEY,
  DEFAULT_AUTOPILOT_SETTINGS,
} from "./config";
import type { AutopilotRunResult, AutopilotSettings } from "./types";

export function loadAutopilotSettings(): AutopilotSettings {
  if (typeof window === "undefined") return { ...DEFAULT_AUTOPILOT_SETTINGS };
  try {
    const raw = localStorage.getItem(AUTOPILOT_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AUTOPILOT_SETTINGS };
    return { ...DEFAULT_AUTOPILOT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_AUTOPILOT_SETTINGS };
  }
}

export function saveAutopilotSettings(
  patch: Partial<AutopilotSettings>,
): AutopilotSettings {
  const next = {
    ...loadAutopilotSettings(),
    ...patch,
    liveAutopilotEnabled: false as const,
    requireHumanApprovalForLive: true as const,
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(AUTOPILOT_SETTINGS_KEY, JSON.stringify(next));
  }
  return next;
}

export function loadLastAutopilotRun(): AutopilotRunResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTOPILOT_LAST_RUN_KEY);
    return raw ? (JSON.parse(raw) as AutopilotRunResult) : null;
  } catch {
    return null;
  }
}

export function saveLastAutopilotRun(result: AutopilotRunResult): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTOPILOT_LAST_RUN_KEY, JSON.stringify(result));
  appendAutopilotRunHistory(result);
  const settings = loadAutopilotSettings();
  saveAutopilotSettings({
    lastRunAt: result.completedAt ?? result.startedAt,
    lastRunId: result.runId,
    nextRunAt: result.nextRunAt,
  });
}

const MAX_RUN_HISTORY = 20;

export function loadAutopilotRunHistory(): AutopilotRunResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AUTOPILOT_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as AutopilotRunResult[]) : [];
  } catch {
    return [];
  }
}

export function appendAutopilotRunHistory(result: AutopilotRunResult): void {
  if (typeof window === "undefined") return;
  const prev = loadAutopilotRunHistory().filter((r) => r.runId !== result.runId);
  const next = [result, ...prev].slice(0, MAX_RUN_HISTORY);
  localStorage.setItem(AUTOPILOT_HISTORY_KEY, JSON.stringify(next));
}
