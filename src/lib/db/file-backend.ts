import { getCronDataDir } from "@/lib/cron/cron-config";
import fs from "fs/promises";
import path from "path";
import type { WarehouseRow, WarehouseTable } from "./types";

function warehouseDir(): string {
  return path.join(getCronDataDir(), "warehouse");
}

function tablePath(table: WarehouseTable): string {
  return path.join(warehouseDir(), `${table}.json`);
}

async function readTable(table: WarehouseTable): Promise<WarehouseRow[]> {
  try {
    const raw = await fs.readFile(tablePath(table), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as WarehouseRow[]) : [];
  } catch {
    return [];
  }
}

async function writeTable(table: WarehouseTable, rows: WarehouseRow[]): Promise<void> {
  const dir = warehouseDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tablePath(table), JSON.stringify(rows, null, 2), "utf8");
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

const HEALTH_FILE = "write-health.json";

export async function fileLoadWriteHealth(): Promise<
  Record<string, import("./types").WriteHealthRecord>
> {
  try {
    const raw = await fs.readFile(path.join(warehouseDir(), HEALTH_FILE), "utf8");
    return JSON.parse(raw) as Record<string, import("./types").WriteHealthRecord>;
  } catch {
    return {};
  }
}

export async function fileSaveWriteHealth(
  health: Record<string, import("./types").WriteHealthRecord>,
): Promise<void> {
  await fs.mkdir(warehouseDir(), { recursive: true });
  await fs.writeFile(
    path.join(warehouseDir(), HEALTH_FILE),
    JSON.stringify(health, null, 2),
    "utf8",
  );
}
