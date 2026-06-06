import { getCronDataDir } from "@/lib/cron/cron-config";
import path from "path";
import type {
  GarageBacktestSummary,
  GarageCustomStrategy,
  StrategyGarageRecord,
  StrategyGarageStage,
} from "./types";
import { STRATEGY_GARAGE_BACKTEST_FILE, STRATEGY_GARAGE_STORE_FILE } from "./config";

interface GarageStore {
  customStrategies: GarageCustomStrategy[];
  records: StrategyGarageRecord[];
  updatedAt: string;
}

interface BacktestStore {
  runs: Record<string, GarageBacktestSummary>;
  updatedAt: string;
}

const memoryStore: GarageStore = { customStrategies: [], records: [], updatedAt: new Date().toISOString() };
const memoryBacktests: BacktestStore = { runs: {}, updatedAt: new Date().toISOString() };

function isServer(): boolean {
  return typeof window === "undefined";
}

function storePath(file: string): string {
  return path.join(getCronDataDir(), file);
}

async function readGarageStore(): Promise<GarageStore> {
  if (!isServer()) return memoryStore;
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(storePath(STRATEGY_GARAGE_STORE_FILE), "utf8");
    const parsed = JSON.parse(raw) as Partial<GarageStore>;
    return {
      customStrategies: parsed.customStrategies ?? [],
      records: parsed.records ?? [],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return { customStrategies: [], records: [], updatedAt: new Date().toISOString() };
  }
}

async function writeGarageStore(store: GarageStore): Promise<void> {
  store.updatedAt = new Date().toISOString();
  if (!isServer()) {
    Object.assign(memoryStore, store);
    return;
  }
  const fs = await import("fs/promises");
  const filePath = storePath(STRATEGY_GARAGE_STORE_FILE);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
}

async function readBacktestStore(): Promise<BacktestStore> {
  if (!isServer()) return memoryBacktests;
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(storePath(STRATEGY_GARAGE_BACKTEST_FILE), "utf8");
    const parsed = JSON.parse(raw) as Partial<BacktestStore>;
    return { runs: parsed.runs ?? {}, updatedAt: parsed.updatedAt ?? new Date().toISOString() };
  } catch {
    return { runs: {}, updatedAt: new Date().toISOString() };
  }
}

async function writeBacktestStore(store: BacktestStore): Promise<void> {
  store.updatedAt = new Date().toISOString();
  if (!isServer()) {
    Object.assign(memoryBacktests, store);
    return;
  }
  const fs = await import("fs/promises");
  const filePath = storePath(STRATEGY_GARAGE_BACKTEST_FILE);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
}

export async function loadCustomStrategies(): Promise<GarageCustomStrategy[]> {
  const store = await readGarageStore();
  return store.customStrategies;
}

export async function loadGarageRecord(sourceId: string): Promise<StrategyGarageRecord | null> {
  const store = await readGarageStore();
  return store.records.find((r) => r.sourceId === sourceId) ?? null;
}

export async function loadAllGarageRecords(): Promise<Record<string, StrategyGarageRecord>> {
  const store = await readGarageStore();
  const map: Record<string, StrategyGarageRecord> = {};
  for (const r of store.records) map[r.sourceId] = r;
  return map;
}

export async function saveCustomStrategy(strategy: GarageCustomStrategy): Promise<void> {
  const store = await readGarageStore();
  const idx = store.customStrategies.findIndex((s) => s.sourceId === strategy.sourceId);
  if (idx >= 0) store.customStrategies[idx] = strategy;
  else store.customStrategies.push(strategy);
  await writeGarageStore(store);
}

export async function upsertGarageRecord(
  sourceId: string,
  patch: Partial<StrategyGarageRecord> & { stage?: StrategyGarageStage },
): Promise<StrategyGarageRecord> {
  const store = await readGarageStore();
  const now = new Date().toISOString();
  const existing = store.records.find((r) => r.sourceId === sourceId);
  const record: StrategyGarageRecord = {
    sourceId,
    stage: patch.stage ?? existing?.stage ?? "IMPORTED",
    importSource: patch.importSource ?? existing?.importSource ?? "manual",
    riskClass: patch.riskClass ?? existing?.riskClass ?? "MEDIUM",
    aiReviewSummary: patch.aiReviewSummary ?? existing?.aiReviewSummary ?? null,
    aiReviewedAt: patch.aiReviewedAt ?? existing?.aiReviewedAt ?? null,
    approvedForAiLoop: patch.approvedForAiLoop ?? existing?.approvedForAiLoop ?? false,
    approvedForAiLoopAt: patch.approvedForAiLoopAt ?? existing?.approvedForAiLoopAt ?? null,
    lastBacktest: patch.lastBacktest ?? existing?.lastBacktest ?? null,
    lastShadow: patch.lastShadow ?? existing?.lastShadow ?? null,
    importStatus: patch.importStatus ?? existing?.importStatus ?? "RESEARCH_ONLY",
    operatorNote: patch.operatorNote ?? existing?.operatorNote ?? null,
    updatedAt: now,
  };
  const idx = store.records.findIndex((r) => r.sourceId === sourceId);
  if (idx >= 0) store.records[idx] = record;
  else store.records.push(record);
  await writeGarageStore(store);
  return record;
}

export async function saveGarageBacktestSummary(
  sourceId: string,
  summary: GarageBacktestSummary,
): Promise<void> {
  const store = await readBacktestStore();
  store.runs[sourceId] = summary;
  await writeBacktestStore(store);
  await upsertGarageRecord(sourceId, {
    lastBacktest: summary,
    stage: "BACKTEST_READY",
    importStatus: "READY_FOR_BACKTEST",
  });
}

export async function loadGarageBacktestSummaries(): Promise<Record<string, GarageBacktestSummary>> {
  const store = await readBacktestStore();
  return store.runs;
}

export async function isGarageApprovedForAiLoop(sourceId: string): Promise<boolean> {
  const record = await loadGarageRecord(sourceId);
  return record?.approvedForAiLoop === true && record.stage === "APPROVED_FOR_USE";
}

export async function resetStrategyGarageForTests(): Promise<void> {
  await writeGarageStore({ customStrategies: [], records: [], updatedAt: new Date().toISOString() });
  await writeBacktestStore({ runs: {}, updatedAt: new Date().toISOString() });
}
