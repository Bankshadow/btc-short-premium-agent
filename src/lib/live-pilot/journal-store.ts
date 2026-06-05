import type { LiveTradeJournalEntry, PilotPreviewQueueItem } from "./types";

export const LIVE_PILOT_JOURNAL_KEY = "btc-desk:live-pilot-journal";
export const LIVE_PILOT_PREVIEW_QUEUE_KEY = "btc-desk:live-pilot-preview-queue";
export const LIVE_PILOT_EMERGENCY_STOP_KEY = "btc-desk:live-pilot-emergency-stop";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadLivePilotJournal(): LiveTradeJournalEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LIVE_PILOT_JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LiveTradeJournalEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveLivePilotJournal(entries: LiveTradeJournalEntry[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(LIVE_PILOT_JOURNAL_KEY, JSON.stringify(entries.slice(0, 200)));
}

export function appendLivePilotJournal(entry: LiveTradeJournalEntry): LiveTradeJournalEntry[] {
  const next = [entry, ...loadLivePilotJournal()];
  saveLivePilotJournal(next);
  return next;
}

export function updateLivePilotJournalEntry(
  liveTradeId: string,
  patch: Partial<LiveTradeJournalEntry>,
): LiveTradeJournalEntry | null {
  let updated: LiveTradeJournalEntry | null = null;
  const next = loadLivePilotJournal().map((e) => {
    if (e.liveTradeId !== liveTradeId) return e;
    updated = { ...e, ...patch };
    return updated;
  });
  if (updated) saveLivePilotJournal(next);
  return updated;
}

export function loadPilotPreviewQueue(): PilotPreviewQueueItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LIVE_PILOT_PREVIEW_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PilotPreviewQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function savePilotPreviewQueue(items: PilotPreviewQueueItem[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(LIVE_PILOT_PREVIEW_QUEUE_KEY, JSON.stringify(items.slice(0, 50)));
}

export function loadPilotEmergencyStop(): boolean {
  if (!isBrowser()) return false;
  return localStorage.getItem(LIVE_PILOT_EMERGENCY_STOP_KEY) === "true";
}

export function setPilotEmergencyStop(active: boolean): void {
  if (!isBrowser()) return;
  localStorage.setItem(LIVE_PILOT_EMERGENCY_STOP_KEY, active ? "true" : "false");
}

export function confirmTokenId(token: string): string {
  return token.slice(0, 12) || "none";
}
