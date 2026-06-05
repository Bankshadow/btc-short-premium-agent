import { getCronDataDir } from "@/lib/cron/cron-config";
import type { OptionsDryRunResult } from "./types";
import fs from "fs/promises";
import path from "path";

const STORE_FILE = "options-dry-run-history.json";
const MAX_ENTRIES = 500;

let memoryHistory: OptionsDryRunResult[] = [];

function storePath(): string {
  return path.join(getCronDataDir(), "warehouse", STORE_FILE);
}

export async function loadServerDryRunHistory(): Promise<OptionsDryRunResult[]> {
  try {
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as OptionsDryRunResult[];
    memoryHistory = Array.isArray(parsed) ? parsed : [];
    return memoryHistory;
  } catch {
    return memoryHistory;
  }
}

export async function appendServerDryRunResult(
  result: OptionsDryRunResult,
): Promise<OptionsDryRunResult[]> {
  memoryHistory = [result, ...memoryHistory].slice(0, MAX_ENTRIES);
  try {
    await fs.mkdir(path.dirname(storePath()), { recursive: true });
    await fs.writeFile(storePath(), JSON.stringify(memoryHistory, null, 2), "utf8");
  } catch {
    /* memory only */
  }
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
