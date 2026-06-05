import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import { loadGovernanceAuditLog } from "@/lib/governance/governance-audit-log";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadLivePilotJournal } from "@/lib/live-pilot/journal-store";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPersistedRegistry } from "@/lib/strategy-registry/strategy-registry-store";
import type { LocalMigrationPayload } from "./types";

/** Browser-only — pushes local cache to warehouse (never deletes localStorage). */
export async function pushWarehouseMigrateLocal(
  extra?: Partial<LocalMigrationPayload>,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    const payload: LocalMigrationPayload = {
      decisionLogs: loadDecisionLog(),
      paperTrades: loadPaperOrders(),
      liveTrades: loadLivePilotJournal(),
      governanceAudit: loadGovernanceAuditLog(),
      incidents: loadIncidents(),
      strategyRegistry: loadPersistedRegistry(),
      ...extra,
    };
    const res = await fetch("/api/db/migrate-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error ?? res.statusText };
    }
    return { ok: true, result: data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Warehouse migrate failed",
    };
  }
}

export async function pushWarehouseAfterAnalyze(
  data: AnalyzeApiResponse,
  entry: DecisionLogEntry,
): Promise<void> {
  try {
    await fetch("/api/db/migrate-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisionLogs: [entry],
        analyzePayload: { data, entryId: entry.id },
      }),
    });
  } catch {
    /* local cache remains; warehouse sync retried via migrate */
  }
}

export async function pushWarehouseLiveTrades(
  trades: LiveTradeJournalEntry[],
): Promise<void> {
  try {
    await fetch("/api/db/migrate-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liveTrades: trades }),
    });
  } catch {
    /* non-blocking */
  }
}
