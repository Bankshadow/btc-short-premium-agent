import type { MacroEventStatus } from "@/lib/types/market";

export const MACRO_EVENT_STORAGE_KEY =
  "btc-short-premium-agent:macro-event";

export type MacroEventType = "none" | "fomc" | "cpi" | "nfp" | "other";

export interface MacroEventSelection {
  type: MacroEventType;
}

export const MACRO_EVENT_OPTIONS: Array<{
  type: MacroEventType;
  label: string;
}> = [
  { type: "none", label: "No major event" },
  { type: "fomc", label: "FOMC" },
  { type: "cpi", label: "CPI" },
  { type: "nfp", label: "NFP" },
  { type: "other", label: "Other high impact USD event" },
];

const EVENT_LABELS: Record<Exclude<MacroEventType, "none">, string> = {
  fomc: "FOMC",
  cpi: "CPI",
  nfp: "NFP",
  other: "Other high impact USD event",
};

export const DEFAULT_MACRO_EVENT: MacroEventSelection = { type: "none" };

export function macroSelectionToStatus(
  selection: MacroEventSelection,
): MacroEventStatus {
  if (selection.type === "none") {
    return { hasEventBeforeSettlement: false };
  }

  return {
    hasEventBeforeSettlement: true,
    eventName: EVENT_LABELS[selection.type],
  };
}

export function loadMacroEventFromStorage(): MacroEventSelection {
  if (typeof window === "undefined") return DEFAULT_MACRO_EVENT;

  try {
    const raw = localStorage.getItem(MACRO_EVENT_STORAGE_KEY);
    if (!raw) return DEFAULT_MACRO_EVENT;
    const parsed = JSON.parse(raw) as MacroEventSelection;
    if (MACRO_EVENT_OPTIONS.some((o) => o.type === parsed.type)) {
      return parsed;
    }
    return DEFAULT_MACRO_EVENT;
  } catch {
    return DEFAULT_MACRO_EVENT;
  }
}

export function saveMacroEventToStorage(selection: MacroEventSelection) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MACRO_EVENT_STORAGE_KEY, JSON.stringify(selection));
}
