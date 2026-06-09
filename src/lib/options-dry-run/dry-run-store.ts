import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { OptionsDryRunResult } from "./types";

const STORE_FILE = "warehouse/options-dry-run-history.json";
const MAX_ENTRIES = 500;

let memoryHistory: OptionsDryRunResult[] = [];

export async function loadServerDryRunHistory(): Promise<OptionsDryRunResult[]> {
  const parsed = await readCronJsonFile<OptionsDryRunResult[]>(STORE_FILE, []);
  memoryHistory = Array.isArray(parsed) ? parsed : [];
  return memoryHistory;
}

export async function appendServerDryRunResult(
  result: OptionsDryRunResult,
): Promise<OptionsDryRunResult[]> {
  memoryHistory = [result, ...memoryHistory].slice(0, MAX_ENTRIES);
  await writeCronJsonFile(STORE_FILE, memoryHistory).catch(() => undefined);
  return memoryHistory;
}

export async function mergeDryRunHistory(
  clientHistory?: OptionsDryRunResult[],
): Promise<OptionsDryRunResult[]> {
  const server = await loadServerDryRunHistory();
  const client = clientHistory ?? [];
  const byId = new Map<string, OptionsDryRunResult>();
  for (const r of [...server, ...client]) {
    byId.set(r.dryRunId, r);
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
