import { getCronDataDir } from "@/lib/cron/cron-config";
import path from "path";
import { TRADE_QUALITY_MAX_SCORES, TRADE_QUALITY_STORE_FILE } from "./config";
import type { TradeQualityScore, TradeQualityStore } from "./types";

const memoryStore: TradeQualityStore = defaultTradeQualityStore();

function isServer(): boolean {
  return typeof window === "undefined";
}

function storePath(): string {
  return path.join(getCronDataDir(), TRADE_QUALITY_STORE_FILE);
}

export function defaultTradeQualityStore(workspaceId = "server-default"): TradeQualityStore {
  return {
    workspaceId,
    scores: [],
    lastUpdatedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

async function readStore(): Promise<TradeQualityStore> {
  if (!isServer()) return memoryStore;
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<TradeQualityStore>;
    return {
      ...defaultTradeQualityStore(parsed.workspaceId),
      ...parsed,
      scores: Array.isArray(parsed.scores) ? parsed.scores : [],
    };
  } catch {
    return defaultTradeQualityStore();
  }
}

async function writeStore(store: TradeQualityStore): Promise<void> {
  store.updatedAt = new Date().toISOString();
  store.scores = store.scores.slice(0, TRADE_QUALITY_MAX_SCORES);
  if (!isServer()) {
    Object.assign(memoryStore, store);
    memoryStore.scores = [...store.scores];
    return;
  }
  const fs = await import("fs/promises");
  const filePath = storePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
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
