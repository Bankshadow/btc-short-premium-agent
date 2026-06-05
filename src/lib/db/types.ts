export const WAREHOUSE_SAFETY_NOTICE =
  "localStorage is UI cache only — warehouse DB is the production source of truth. Migration never deletes browser data.";

export type WarehouseTable =
  | "decision_logs"
  | "agent_outputs"
  | "paper_trades"
  | "live_trades"
  | "live_orders"
  | "execution_events"
  | "market_snapshots"
  | "risk_events"
  | "strategy_versions"
  | "rule_versions"
  | "governance_audit_logs"
  | "incidents"
  | "command_center_status"
  | "portfolio_snapshots"
  | "learning_reports";

export const WAREHOUSE_TABLES: WarehouseTable[] = [
  "decision_logs",
  "agent_outputs",
  "paper_trades",
  "live_trades",
  "live_orders",
  "execution_events",
  "market_snapshots",
  "risk_events",
  "strategy_versions",
  "rule_versions",
  "governance_audit_logs",
  "incidents",
  "command_center_status",
  "portfolio_snapshots",
  "learning_reports",
];

export type WarehouseBackend = "supabase" | "file" | "none";

export interface WarehouseRow {
  client_id: string;
  recorded_at: string;
  payload: Record<string, unknown>;
  status?: string;
  severity?: string;
  event_type?: string;
  strategy_id?: string;
  rule_id?: string;
  live_trade_id?: string;
  decision_log_id?: string;
  agent_name?: string;
}

export interface WriteResult {
  ok: boolean;
  table: WarehouseTable;
  written: number;
  error?: string;
}

export interface WriteHealthRecord {
  domain: string;
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  liveBlocked: boolean;
}

export interface DbStatusReport {
  generatedAt: string;
  backend: WarehouseBackend;
  configured: boolean;
  sourceOfTruth: "warehouse" | "local_only";
  tables: Record<WarehouseTable, { count: number }>;
  writeHealth: WriteHealthRecord[];
  liveExecutionBlocked: boolean;
  liveBlockReason: string | null;
  safetyNotice: string;
}

export interface MigrationResult {
  migratedAt: string;
  backend: WarehouseBackend;
  tables: Partial<Record<WarehouseTable, number>>;
  errors: string[];
  localStoragePreserved: true;
}

export interface WarehouseSnapshot {
  generatedAt: string;
  backend: WarehouseBackend;
  counts: Record<WarehouseTable, number>;
  lastWrites: Array<{
    domain: string;
    lastOkAt: string | null;
    lastError: string | null;
  }>;
  missingRecords: string[];
  migrationHint: string;
}

export interface LocalMigrationPayload {
  decisionLogs?: unknown[];
  paperTrades?: unknown[];
  liveTrades?: unknown[];
  governanceAudit?: unknown[];
  incidents?: unknown[];
  strategyRegistry?: unknown;
  portfolioSnapshot?: unknown;
  learningReports?: unknown[];
  commandCenterStatus?: unknown;
}

export interface StorageSourceComparison {
  domain: string;
  localCount: number;
  warehouseCount: number;
  inSync: boolean;
}
