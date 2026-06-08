import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { WarehouseRow, WarehouseTable } from "./types";

async function readTable(table: WarehouseTable): Promise<WarehouseRow[]> {
  const parsed = await readCronJsonFile(`warehouse/${table}.json`, [] as WarehouseRow[]);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeTable(table: WarehouseTable, rows: WarehouseRow[]): Promise<void> {
  await writeCronJsonFile(`warehouse/${table}.json`, rows);
}

export async function fileUpsertRows(
  table: WarehouseTable,
  rows: WarehouseRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const existing = await readTable(table);
  const byId = new Map(existing.map((r) => [r.client_id, r]));
  for (const row of rows) {
    byId.set(row.client_id, row);
  }
  const merged = [...byId.values()].sort((a, b) =>
    b.recorded_at.localeCompare(a.recorded_at),
  );
  await writeTable(table, merged.slice(0, 5000));
  return rows.length;
}

export async function fileListRows(
  table: WarehouseTable,
  limit = 100,
): Promise<WarehouseRow[]> {
  const rows = await readTable(table);
  return rows.slice(0, limit);
}

export async function fileCountRows(
  table: WarehouseTable,
): Promise<number> {
  return (await readTable(table)).length;
}

const HEALTH_FILE = "warehouse/write-health.json";

export async function fileLoadWriteHealth(): Promise<
  Record<string, import("./types").WriteHealthRecord>
> {
  return readCronJsonFile(
    HEALTH_FILE,
    {} as Record<string, import("./types").WriteHealthRecord>,
  );
}

export async function fileSaveWriteHealth(
  health: Record<string, import("./types").WriteHealthRecord>,
): Promise<void> {
  await writeCronJsonFile(HEALTH_FILE, health);
}
