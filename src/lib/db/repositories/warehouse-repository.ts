import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/client";
import { resolveWarehouseBackend } from "../client";
import {
  fileCountRows,
  fileListRows,
  fileUpsertRows,
} from "../file-backend";
import type { WarehouseRow, WarehouseTable, WriteResult } from "../types";

function rowToDb(table: WarehouseTable, row: WarehouseRow): Record<string, unknown> {
  const base: Record<string, unknown> = {
    client_id: row.client_id,
    recorded_at: row.recorded_at,
    payload: row.payload,
    updated_at: new Date().toISOString(),
  };
  if (row.status != null) base.status = row.status;
  if (row.severity != null) base.severity = row.severity;
  if (row.event_type != null) base.event_type = row.event_type;
  if (row.strategy_id != null) base.strategy_id = row.strategy_id;
  if (row.rule_id != null) base.rule_id = row.rule_id;
  if (row.live_trade_id != null) base.live_trade_id = row.live_trade_id;
  if (row.decision_log_id != null) base.decision_log_id = row.decision_log_id;
  if (row.agent_name != null) base.agent_name = row.agent_name;
  if (table === "command_center_status" && row.status) {
    base.status = row.status;
  }
  return base;
}

function rowFromDb(raw: Record<string, unknown>): WarehouseRow {
  return {
    client_id: String(raw.client_id ?? raw.id ?? ""),
    recorded_at: String(raw.recorded_at ?? new Date().toISOString()),
    payload:
      raw.payload && typeof raw.payload === "object"
        ? (raw.payload as Record<string, unknown>)
        : {},
    status: raw.status != null ? String(raw.status) : undefined,
    severity: raw.severity != null ? String(raw.severity) : undefined,
    event_type: raw.event_type != null ? String(raw.event_type) : undefined,
  };
}

export async function upsertWarehouseRows(
  table: WarehouseTable,
  rows: WarehouseRow[],
): Promise<WriteResult> {
  if (rows.length === 0) {
    return { ok: true, table, written: 0 };
  }

  const backend = resolveWarehouseBackend();
  try {
    if (backend === "supabase" && isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from(table)
        .upsert(rows.map((r) => rowToDb(table, r)), { onConflict: "client_id" });
      if (error) {
        return { ok: false, table, written: 0, error: error.message };
      }
      return { ok: true, table, written: rows.length };
    }

    const written = await fileUpsertRows(table, rows);
    return { ok: true, table, written };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upsert failed";
    return { ok: false, table, written: 0, error: message };
  }
}

export async function listWarehouseRows(
  table: WarehouseTable,
  limit = 100,
): Promise<WarehouseRow[]> {
  const backend = resolveWarehouseBackend();
  if (backend === "supabase" && isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("recorded_at", { ascending: false })
        .limit(limit);
      if (error || !data) return [];
      return data.map((r) => rowFromDb(r as Record<string, unknown>));
    } catch {
      return [];
    }
  }
  return fileListRows(table, limit);
}

export async function countWarehouseRows(
  table: WarehouseTable,
): Promise<number> {
  const backend = resolveWarehouseBackend();
  if (backend === "supabase" && isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    } catch {
      return 0;
    }
  }
  return fileCountRows(table);
}
