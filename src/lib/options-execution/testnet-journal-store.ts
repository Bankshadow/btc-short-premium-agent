import type { OptionsTestnetJournalEntry } from "./types";

export const OPTIONS_TESTNET_JOURNAL_KEY = "btc-desk:options-testnet-journal";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadOptionsTestnetJournal(): OptionsTestnetJournalEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(OPTIONS_TESTNET_JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OptionsTestnetJournalEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveOptionsTestnetJournal(
  entries: OptionsTestnetJournalEntry[],
): void {
  if (!isBrowser()) return;
  localStorage.setItem(
    OPTIONS_TESTNET_JOURNAL_KEY,
    JSON.stringify(entries.slice(0, 200)),
  );
}

export function appendOptionsTestnetJournal(
  entry: OptionsTestnetJournalEntry,
): OptionsTestnetJournalEntry[] {
  const next = [entry, ...loadOptionsTestnetJournal()];
  saveOptionsTestnetJournal(next);
  return next;
}

export function updateOptionsTestnetJournalEntry(
  optionsTestnetTradeId: string,
  patch: Partial<OptionsTestnetJournalEntry>,
): OptionsTestnetJournalEntry | null {
  let updated: OptionsTestnetJournalEntry | null = null;
  const next = loadOptionsTestnetJournal().map((e) => {
    if (e.optionsTestnetTradeId !== optionsTestnetTradeId) return e;
    updated = { ...e, ...patch };
    return updated;
  });
  if (updated) saveOptionsTestnetJournal(next);
  return updated;
}

export function newOptionsTestnetTradeId(): string {
  return `opt-tn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
