import type { TestnetMonitorJournalEvent } from "./types";

export const TESTNET_MONITOR_JOURNAL_KEY = "btc-desk:testnet-monitor-journal";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadClientMonitorJournal(): TestnetMonitorJournalEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(TESTNET_MONITOR_JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TestnetMonitorJournalEvent[]) : [];
  } catch {
    return [];
  }
}

export function saveClientMonitorJournal(
  events: TestnetMonitorJournalEvent[],
): void {
  if (!isBrowser()) return;
  localStorage.setItem(
    TESTNET_MONITOR_JOURNAL_KEY,
    JSON.stringify(events.slice(0, 200)),
  );
}

export function appendClientMonitorJournal(
  event: TestnetMonitorJournalEvent,
): void {
  saveClientMonitorJournal([event, ...loadClientMonitorJournal()]);
}
