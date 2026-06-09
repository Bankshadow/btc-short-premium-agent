import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { StrategyShadowTrade } from "./types";

const STORE_FILE = "strategy-shadow-trades.json";

interface ShadowTradeStore {
  trades: StrategyShadowTrade[];
  updatedAt: string;
}

async function loadStore(): Promise<ShadowTradeStore> {
  const parsed = await readCronJsonFile<Partial<ShadowTradeStore>>(STORE_FILE, {});
  return {
    trades: parsed.trades ?? [],
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
  };
}

async function saveStore(store: ShadowTradeStore): Promise<void> {
  await writeCronJsonFile(STORE_FILE, store);
}

export async function loadShadowTrades(): Promise<StrategyShadowTrade[]> {
  const store = await loadStore();
  return store.trades;
}

export async function appendShadowTrades(
  trades: StrategyShadowTrade[],
): Promise<StrategyShadowTrade[]> {
  if (trades.length === 0) return loadShadowTrades();
  const store = await loadStore();
  const existingIds = new Set(store.trades.map((t) => t.id));
  const novel = trades.filter((t) => !existingIds.has(t.id));
  store.trades = [...novel, ...store.trades].slice(0, 2000);
  store.updatedAt = new Date().toISOString();
  await saveStore(store);
  return store.trades;
}

export async function replaceShadowTradesForRun(input: {
  runKey: string;
  trades: StrategyShadowTrade[];
}): Promise<StrategyShadowTrade[]> {
  const store = await loadStore();
  const filtered = store.trades.filter((t) => !t.id.startsWith(input.runKey));
  store.trades = [...input.trades, ...filtered].slice(0, 2000);
  store.updatedAt = new Date().toISOString();
  await saveStore(store);
  return store.trades;
}
