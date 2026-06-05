import { saveGovernanceState } from "@/lib/governance/governance-state";
import { autoOpenFromScan } from "@/lib/multi-asset/perp-paper-store";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { PerpDirectionalSignal } from "@/lib/multi-asset/types";
import type {
  ApplyAutomationResult,
  AutomationAction,
  DeskAutomationResult,
  DeskAutomationSettings,
} from "./automation-types";
import {
  AUTOMATION_LAST_RUN_KEY,
  AUTOMATION_SETTINGS_KEY,
  DEFAULT_AUTOMATION_SETTINGS,
} from "./automation-types";

export function loadAutomationSettings(): DeskAutomationSettings {
  if (typeof window === "undefined") return DEFAULT_AUTOMATION_SETTINGS;
  try {
    const raw = localStorage.getItem(AUTOMATION_SETTINGS_KEY);
    if (!raw) return DEFAULT_AUTOMATION_SETTINGS;
    return { ...DEFAULT_AUTOMATION_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_AUTOMATION_SETTINGS;
  }
}

export function saveAutomationSettings(
  patch: Partial<DeskAutomationSettings>,
): DeskAutomationSettings {
  const next = { ...loadAutomationSettings(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(AUTOMATION_SETTINGS_KEY, JSON.stringify(next));
  }
  return next;
}

export function saveLastAutomationRun(result: DeskAutomationResult): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTOMATION_LAST_RUN_KEY, JSON.stringify(result));
  saveAutomationSettings({
    lastRunAt: result.timestamp,
    lastRunId: result.runId,
  });
}

export function loadLastAutomationRun(): DeskAutomationResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTOMATION_LAST_RUN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DeskAutomationResult;
  } catch {
    return null;
  }
}

/** Applies safe client-side automation actions (paper, governance hints). */
export function applyAutomationActions(
  actions: AutomationAction[],
  settings: DeskAutomationSettings = loadAutomationSettings(),
): ApplyAutomationResult {
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const act of actions) {
    if (!act.autoApplicable) {
      skipped.push(`${act.id}: not auto-applicable`);
      continue;
    }

    if (act.type === "OPEN_PAPER_PERP" && settings.autoApplyPaper) {
      const signal = act.payload as { signal?: PerpDirectionalSignal } | undefined;
      if (signal?.signal) {
        const opened: PerpPaperPosition[] = autoOpenFromScan([signal.signal]);
        if (opened.length > 0) {
          applied.push(`${act.id}: opened paper ${signal.signal.symbol}`);
        } else {
          skipped.push(`${act.id}: paper already open or blocked`);
        }
      }
      continue;
    }

    if (act.type === "PAUSE_PAPER_AUTO") {
      saveGovernanceState(
        { pausePaperAutoOpen: true },
        { action: "automation_pause_paper", detail: act.detail },
      );
      applied.push(`${act.id}: pause paper auto-open`);
      continue;
    }

    if (act.type === "ENABLE_SAFE_MODE" && settings.autoApplySafeMode) {
      saveGovernanceState(
        { safeMode: true },
        { action: "automation_safe_mode", detail: act.detail },
      );
      applied.push(`${act.id}: safe mode on`);
      continue;
    }

    skipped.push(`${act.id}: ${act.type}`);
  }

  return { applied, skipped };
}
