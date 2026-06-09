import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import { TRADE_BLACK_BOX_MAX_RECORDS, TRADE_BLACK_BOX_STORE_FILE } from "./config";
import type { TradeBlackBoxRecord, TradeBlackBoxStore } from "./types";

const memoryStore: TradeBlackBoxStore = defaultTradeBlackBoxStore();

function isServer(): boolean {
  return typeof window === "undefined";
}

export function defaultTradeBlackBoxStore(workspaceId = "server-default"): TradeBlackBoxStore {
  return {
    workspaceId,
    records: [],
    lastCapturedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

async function readStore(): Promise<TradeBlackBoxStore> {
  if (!isServer()) return memoryStore;
  const parsed = await readCronJsonFile<Partial<TradeBlackBoxStore>>(
    TRADE_BLACK_BOX_STORE_FILE,
    {},
  );
  return {
    ...defaultTradeBlackBoxStore(parsed.workspaceId),
    ...parsed,
    records: Array.isArray(parsed.records) ? parsed.records : [],
  };
}

async function writeStore(store: TradeBlackBoxStore): Promise<void> {
  store.updatedAt = new Date().toISOString();
  store.records = store.records.slice(0, TRADE_BLACK_BOX_MAX_RECORDS);
  if (!isServer()) {
    Object.assign(memoryStore, store);
    memoryStore.records = [...store.records];
    return;
  }
  await writeCronJsonFile(TRADE_BLACK_BOX_STORE_FILE, store);
}

export async function loadTradeBlackBoxStore(
  workspaceId = "server-default",
): Promise<TradeBlackBoxStore> {
  const store = await readStore();
  store.workspaceId = workspaceId;
  return store;
}

export async function upsertTradeBlackBoxRecord(
  record: TradeBlackBoxRecord,
  workspaceId = "server-default",
): Promise<TradeBlackBoxStore> {
  const store = await loadTradeBlackBoxStore(workspaceId);
  store.records = [
    record,
    ...store.records.filter((r) => r.tradeId !== record.tradeId),
  ].slice(0, TRADE_BLACK_BOX_MAX_RECORDS);
  store.lastCapturedAt = record.updatedAt;
  await writeStore(store);
  return store;
}

export async function getTradeBlackBoxByTradeId(
  tradeId: string,
  workspaceId = "server-default",
): Promise<TradeBlackBoxRecord | null> {
  const store = await loadTradeBlackBoxStore(workspaceId);
  return store.records.find((r) => r.tradeId === tradeId || r.blackBoxId === tradeId) ?? null;
}

export async function resetTradeBlackBoxStoreForTests(): Promise<void> {
  await writeStore(defaultTradeBlackBoxStore());
}
