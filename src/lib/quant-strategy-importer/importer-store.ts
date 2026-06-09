import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { QuantImportStatus } from "./types";

const STORE_FILE = "quant-strategy-imports.json";

export interface PersistedImportRecord {
  sourceId: string;
  importStatus: QuantImportStatus;
  lastReviewedAt: string;
  operatorNote?: string;
}

interface PersistedImportStore {
  records: PersistedImportRecord[];
  updatedAt: string;
}

async function loadStore(): Promise<PersistedImportStore> {
  const parsed = await readCronJsonFile<Partial<PersistedImportStore>>(STORE_FILE, {});
  return {
    records: parsed.records ?? [],
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
  };
}

async function saveStore(store: PersistedImportStore): Promise<void> {
  await writeCronJsonFile(STORE_FILE, store);
}

export async function loadImportStatusOverrides(): Promise<
  Record<string, PersistedImportRecord>
> {
  const store = await loadStore();
  const map: Record<string, PersistedImportRecord> = {};
  for (const record of store.records) {
    map[record.sourceId] = record;
  }
  return map;
}

export async function saveImportStatusOverride(input: {
  sourceId: string;
  importStatus: QuantImportStatus;
  operatorNote?: string;
}): Promise<PersistedImportRecord> {
  const store = await loadStore();
  const now = new Date().toISOString();
  const record: PersistedImportRecord = {
    sourceId: input.sourceId,
    importStatus: input.importStatus,
    lastReviewedAt: now,
    operatorNote: input.operatorNote,
  };
  const idx = store.records.findIndex((r) => r.sourceId === input.sourceId);
  if (idx >= 0) {
    store.records[idx] = record;
  } else {
    store.records.push(record);
  }
  store.updatedAt = now;
  await saveStore(store);
  return record;
}
