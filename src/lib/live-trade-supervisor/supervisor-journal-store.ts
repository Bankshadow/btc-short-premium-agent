import type { SupervisorAction, SupervisorJournalEntry } from "./types";

export const LIVE_SUPERVISOR_JOURNAL_KEY = "btc-desk:live-supervisor-journal";

export function loadSupervisorJournal(): SupervisorJournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LIVE_SUPERVISOR_JOURNAL_KEY);
    return raw ? (JSON.parse(raw) as SupervisorJournalEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendSupervisorJournal(
  entry: Omit<SupervisorJournalEntry, "id" | "timestamp"> & {
    id?: string;
    timestamp?: string;
  },
): SupervisorJournalEntry {
  const row: SupervisorJournalEntry = {
    id: entry.id ?? `sup-j-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    liveTradeId: entry.liveTradeId,
    action: entry.action,
    operatorDecision: entry.operatorDecision,
    operatorNote: entry.operatorNote,
    recommendationSnapshot: entry.recommendationSnapshot,
    alerts: entry.alerts,
  };
  const next = [row, ...loadSupervisorJournal()].slice(0, 100);
  if (typeof window !== "undefined") {
    localStorage.setItem(LIVE_SUPERVISOR_JOURNAL_KEY, JSON.stringify(next));
  }
  return row;
}

export function logOperatorDecision(input: {
  liveTradeId: string;
  action: SupervisorAction;
  recommendationSnapshot: SupervisorAction;
  operatorDecision: SupervisorJournalEntry["operatorDecision"];
  operatorNote: string;
  alerts: string[];
}): SupervisorJournalEntry {
  return appendSupervisorJournal(input);
}
