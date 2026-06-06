import {
  readScopedJson,
  writeScopedJson,
  type ScopedDomain,
} from "@/lib/platform/scoped-storage";
import { getActiveWorkspaceId } from "@/lib/platform/workspace-registry";
import { buildLedgerEntriesFromSources } from "./build-from-sources";
import { evaluateLedgerHealth } from "./health";
import { hashLedgerPayload } from "./hash";
import { buildTradeTimelines } from "./timelines";
import type {
  LedgerEntry,
  LedgerSourceBundle,
  UnifiedLedgerSnapshot,
} from "./types";

const LEDGER_DOMAIN: ScopedDomain = "unified-ledger";

interface PersistedLedger {
  workspaceId: string;
  lastSyncedAt: string;
  entries: LedgerEntry[];
  corrections: LedgerEntry[];
}

function emptyPersisted(workspaceId: string): PersistedLedger {
  return {
    workspaceId,
    lastSyncedAt: new Date().toISOString(),
    entries: [],
    corrections: [],
  };
}

function loadPersisted(workspaceId?: string): PersistedLedger {
  const ws = workspaceId ?? getActiveWorkspaceId();
  return readScopedJson(LEDGER_DOMAIN, emptyPersisted(ws), ws);
}

function savePersisted(data: PersistedLedger, workspaceId?: string): void {
  const ws = workspaceId ?? data.workspaceId;
  writeScopedJson(LEDGER_DOMAIN, data, ws);
}

/** LIVE entries are append-only — never mutate in place. */
function mergeEntries(
  existing: LedgerEntry[],
  incoming: LedgerEntry[],
): LedgerEntry[] {
  const byId = new Map<string, LedgerEntry>();
  for (const e of existing) byId.set(e.ledgerEntryId, e);

  for (const e of incoming) {
    const prev = byId.get(e.ledgerEntryId);
    if (!prev) {
      byId.set(e.ledgerEntryId, e);
      continue;
    }
    if (prev.environment === "LIVE" || e.environment === "LIVE") {
      if (prev.hash !== e.hash) {
        continue;
      }
    }
    byId.set(e.ledgerEntryId, e);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export function syncLedgerFromSources(
  bundle: LedgerSourceBundle,
  workspaceId?: string,
): UnifiedLedgerSnapshot {
  const ws = workspaceId ?? getActiveWorkspaceId();
  const persisted = loadPersisted(ws);
  const derived = buildLedgerEntriesFromSources(bundle, ws);
  const merged = mergeEntries(persisted.entries, derived);
  const now = new Date().toISOString();

  const next: PersistedLedger = {
    workspaceId: ws,
    lastSyncedAt: now,
    entries: merged,
    corrections: persisted.corrections,
  };
  savePersisted(next, ws);

  const all = [...merged, ...persisted.corrections];
  const health = evaluateLedgerHealth(all, now);

  return {
    workspaceId: ws,
    generatedAt: now,
    entries: all,
    health,
    tradeTimelines: buildTradeTimelines(all),
  };
}

export function appendLedgerCorrection(
  correctionOf: string,
  payload: Record<string, unknown>,
  meta: {
    sourceType: LedgerEntry["sourceType"];
    environment: LedgerEntry["environment"];
    linkedDecisionId?: string | null;
    linkedTradeId?: string | null;
    reason: string;
  },
  workspaceId?: string,
): LedgerEntry {
  const ws = workspaceId ?? getActiveWorkspaceId();
  const persisted = loadPersisted(ws);
  const original = [...persisted.entries, ...persisted.corrections].find(
    (e) => e.ledgerEntryId === correctionOf,
  );

  const entry: LedgerEntry = {
    ledgerEntryId: `led-correction-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: ws,
    entryKind: "CORRECTION",
    sourceType: meta.sourceType,
    environment: meta.environment,
    linkedDecisionId: meta.linkedDecisionId ?? original?.linkedDecisionId ?? null,
    linkedTradeId: meta.linkedTradeId ?? original?.linkedTradeId ?? null,
    linkedOrderId: original?.linkedOrderId ?? null,
    linkedRunId: original?.linkedRunId ?? null,
    timestamp: new Date().toISOString(),
    payload: { ...payload, reason: meta.reason, originalEntryId: correctionOf },
    hash: "",
    correctionOf,
  };
  entry.hash = hashLedgerPayload(entry.payload);

  persisted.corrections = [entry, ...persisted.corrections].slice(0, 500);
  savePersisted(persisted, ws);
  return entry;
}

export function loadPersistedLedgerEntries(workspaceId?: string): LedgerEntry[] {
  const p = loadPersisted(workspaceId);
  return [...p.entries, ...p.corrections];
}
