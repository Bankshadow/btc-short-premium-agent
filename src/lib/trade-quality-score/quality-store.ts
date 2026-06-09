import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import { TRADE_QUALITY_MAX_SCORES, TRADE_QUALITY_STORE_FILE } from "./config";
import type { TradeQualityScore, TradeQualityStore } from "./types";

const memoryStore: TradeQualityStore = defaultTradeQualityStore();

export function defaultTradeQualityStore(workspaceId = "server-default"): TradeQualityStore {
  return {
    workspaceId,
    scores: [],
    lastUpdatedAt: null,
    updatedAt: new Date().toISOString(),
  };
}
function isServer(): boolean {
  return typeof window === "undefined";
}

async function readStore(): Promise<TradeQualityStore> {
  if (!isServer()) return memoryStore;
  const parsed = await readCronJsonFile<Partial<TradeQualityStore>>(
    TRADE_QUALITY_STORE_FILE,
    {},
  );
  return {
    ...defaultTradeQualityStore(parsed.workspaceId),
    ...parsed,
    scores: Array.isArray(parsed.scores) ? parsed.scores : [],
  };
}

async function writeStore(store: TradeQualityStore): Promise<void> {
  store.updatedAt = new Date().toISOString();
  store.scores = store.scores.slice(0, TRADE_QUALITY_MAX_SCORES);
  if (!isServer()) {
    Object.assign(memoryStore, store);
    memoryStore.scores = [...store.scores];
    return;
  }
  await writeCronJsonFile(TRADE_QUALITY_STORE_FILE, store);
}

export async function loadTradeQualityStore(
  workspaceId = "server-default",
): Promise<TradeQualityStore> {
  const store = await readStore();
  store.workspaceId = workspaceId;
  return store;
}

export async function upsertTradeQualityScore(
  score: TradeQualityScore,
  workspaceId = "server-default",
): Promise<TradeQualityStore> {
  const store = await loadTradeQualityStore(workspaceId);
  store.scores = [
    score,
    ...store.scores.filter((s) => s.decisionLogId !== score.decisionLogId),
  ].slice(0, TRADE_QUALITY_MAX_SCORES);
  store.lastUpdatedAt = score.generatedAt;
  await writeStore(store);
  return store;
}

export async function getTradeQualityByDecisionId(
  decisionLogId: string,
  workspaceId = "server-default",
): Promise<TradeQualityScore | null> {
  const store = await loadTradeQualityStore(workspaceId);
  return store.scores.find((s) => s.decisionLogId === decisionLogId) ?? null;
}

export async function resetTradeQualityStoreForTests(): Promise<void> {
  await writeStore(defaultTradeQualityStore());
}
