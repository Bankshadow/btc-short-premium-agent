import { resolveWarehouseBackend, isWarehouseConfigured } from "./client";
import { countWarehouseRows } from "./repositories/warehouse-repository";
import { assertLiveWriteHealthy, loadWriteHealth } from "./write-health";
import {
  WAREHOUSE_SAFETY_NOTICE,
  WAREHOUSE_TABLES,
  type DbStatusReport,
  type WarehouseSnapshot,
  type WarehouseTable,
} from "./types";

export { compareStorageSources } from "./storage-comparison";

export async function buildDbStatusReport(): Promise<DbStatusReport> {
  const backend = resolveWarehouseBackend();
  const tables = {} as Record<WarehouseTable, { count: number }>;

  for (const table of WAREHOUSE_TABLES) {
    tables[table] = { count: await countWarehouseRows(table) };
  }

  const writeHealth = await loadWriteHealth();
  const liveCheck = await assertLiveWriteHealthy();

  return {
    generatedAt: new Date().toISOString(),
    backend,
    configured: isWarehouseConfigured(),
    sourceOfTruth: isWarehouseConfigured() ? "warehouse" : "local_only",
    tables,
    writeHealth,
    liveExecutionBlocked: !liveCheck.allowed,
    liveBlockReason: liveCheck.reason,
    safetyNotice: WAREHOUSE_SAFETY_NOTICE,
  };
}

export async function buildWarehouseSnapshot(
  localCounts?: Partial<Record<string, number>>,
): Promise<WarehouseSnapshot> {
  const status = await buildDbStatusReport();
  const counts = {} as Record<WarehouseTable, number>;
  for (const table of WAREHOUSE_TABLES) {
    counts[table] = status.tables[table].count;
  }

  const missingRecords: string[] = [];
  if (localCounts) {
    if ((localCounts.decisionLogs ?? 0) > counts.decision_logs) {
      missingRecords.push(
        `decision_logs: local ${localCounts.decisionLogs} > warehouse ${counts.decision_logs}`,
      );
    }
    if ((localCounts.paperTrades ?? 0) > counts.paper_trades) {
      missingRecords.push(
        `paper_trades: local ${localCounts.paperTrades} > warehouse ${counts.paper_trades}`,
      );
    }
    if ((localCounts.liveTrades ?? 0) > counts.live_trades) {
      missingRecords.push(
        `live_trades: local ${localCounts.liveTrades} > warehouse ${counts.live_trades}`,
      );
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    backend: status.backend,
    counts,
    lastWrites: status.writeHealth.map((h) => ({
      domain: h.domain,
      lastOkAt: h.lastOkAt,
      lastError: h.lastError,
    })),
    missingRecords,
    migrationHint:
      missingRecords.length > 0
        ? "Run POST /api/db/migrate-local to sync local cache to warehouse."
        : "Warehouse counts meet or exceed local cache.",
  };
}
