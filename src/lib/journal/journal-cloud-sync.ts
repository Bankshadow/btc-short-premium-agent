import type { DecisionLogEntry } from "./decision-log-types";
import { loadDecisionLog } from "./decision-log";

export interface JournalSyncPayload {
  entries: DecisionLogEntry[];
}

export interface JournalSyncResponse {
  ok: boolean;
  synced: number;
  pulled?: DecisionLogEntry[];
  error?: string;
}

export async function syncJournalToServer(
  entries?: DecisionLogEntry[],
): Promise<JournalSyncResponse> {
  try {
    const response = await fetch("/api/journal/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: entries ?? loadDecisionLog() }),
    });
    const data = (await response.json()) as JournalSyncResponse;
    if (!response.ok) {
      return { ok: false, synced: 0, error: data.error ?? `HTTP ${response.status}` };
    }
    return data;
  } catch (err) {
    return {
      ok: false,
      synced: 0,
      error: err instanceof Error ? err.message : "Journal sync failed",
    };
  }
}

export async function pullJournalFromServer(): Promise<DecisionLogEntry[]> {
  try {
    const response = await fetch("/api/journal/sync", { cache: "no-store" });
    if (!response.ok) return [];
    const data = (await response.json()) as JournalSyncResponse;
    return data.pulled ?? [];
  } catch {
    return [];
  }
}
