import type { OptionsDryRunResult } from "./types";

export const OPTIONS_DRY_RUN_HISTORY_KEY = "btc-desk:options-dry-run-history";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadOptionsDryRunHistory(): OptionsDryRunResult[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(OPTIONS_DRY_RUN_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OptionsDryRunResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOptionsDryRunHistory(results: OptionsDryRunResult[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(
    OPTIONS_DRY_RUN_HISTORY_KEY,
    JSON.stringify(results.slice(0, 200)),
  );
}

export function appendOptionsDryRunResult(
  result: OptionsDryRunResult,
): OptionsDryRunResult[] {
  const next = [result, ...loadOptionsDryRunHistory()].slice(0, 200);
  saveOptionsDryRunHistory(next);
  return next;
}
