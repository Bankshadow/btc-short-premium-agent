import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fileLoadWriteHealth,
  fileSaveWriteHealth,
} from "./file-backend";
import { resolveWarehouseBackend } from "./client";
import type { WriteHealthRecord, WriteResult } from "./types";

const LIVE_DOMAINS = ["live_trades", "live_orders", "execution_events"] as const;

let memoryHealth: Record<string, WriteHealthRecord> = {};

function defaultHealth(domain: string): WriteHealthRecord {
  return {
    domain,
    lastOkAt: null,
    lastErrorAt: null,
    lastError: null,
    consecutiveFailures: 0,
    liveBlocked: false,
  };
}

export async function loadWriteHealth(): Promise<WriteHealthRecord[]> {
  const backend = resolveWarehouseBackend();
  if (backend === "file") {
    const file = await fileLoadWriteHealth();
    memoryHealth = { ...memoryHealth, ...file };
  } else if (backend === "supabase" && isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.from("warehouse_write_health").select("*");
      for (const row of data ?? []) {
        const r = row as Record<string, unknown>;
        memoryHealth[String(r.domain)] = {
          domain: String(r.domain),
          lastOkAt: r.last_ok_at ? String(r.last_ok_at) : null,
          lastErrorAt: r.last_error_at ? String(r.last_error_at) : null,
          lastError: r.last_error ? String(r.last_error) : null,
          consecutiveFailures: Number(r.consecutive_failures ?? 0),
          liveBlocked: Number(r.consecutive_failures ?? 0) >= 3,
        };
      }
    } catch {
      /* use memory */
    }
  }
  return Object.values(memoryHealth);
}

async function persistHealth(domain: string, record: WriteHealthRecord): Promise<void> {
  memoryHealth[domain] = record;
  const backend = resolveWarehouseBackend();
  if (backend === "file") {
    await fileSaveWriteHealth(memoryHealth);
  } else if (backend === "supabase" && isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from("warehouse_write_health").upsert(
        {
          domain,
          last_ok_at: record.lastOkAt,
          last_error_at: record.lastErrorAt,
          last_error: record.lastError,
          consecutive_failures: record.consecutiveFailures,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "domain" },
      );
    } catch {
      /* memory only */
    }
  }
}

export async function recordWriteSuccess(domain: string): Promise<void> {
  const prev = memoryHealth[domain] ?? defaultHealth(domain);
  const next: WriteHealthRecord = {
    ...prev,
    lastOkAt: new Date().toISOString(),
    consecutiveFailures: 0,
    liveBlocked: false,
  };
  await persistHealth(domain, next);
}

export async function recordWriteFailure(
  domain: string,
  error: string,
): Promise<void> {
  const prev = memoryHealth[domain] ?? defaultHealth(domain);
  const failures = prev.consecutiveFailures + 1;
  const next: WriteHealthRecord = {
    ...prev,
    lastErrorAt: new Date().toISOString(),
    lastError: error,
    consecutiveFailures: failures,
    liveBlocked: LIVE_DOMAINS.includes(domain as (typeof LIVE_DOMAINS)[number])
      ? failures >= 1
      : failures >= 3,
  };
  await persistHealth(domain, next);
}

export async function recordWriteResult(result: WriteResult): Promise<void> {
  if (result.ok) {
    await recordWriteSuccess(result.table);
  } else {
    await recordWriteFailure(result.table, result.error ?? "Write failed");
  }
}

export async function assertLiveWriteHealthy(): Promise<{
  allowed: boolean;
  reason: string | null;
}> {
  await loadWriteHealth();
  for (const domain of LIVE_DOMAINS) {
    const h = memoryHealth[domain];
    if (h?.liveBlocked || (h?.consecutiveFailures ?? 0) >= 1) {
      return {
        allowed: false,
        reason:
          h?.lastError ??
          `Warehouse write failures for ${domain} — live execution blocked until DB is healthy.`,
      };
    }
  }
  if (!resolveWarehouseBackend()) {
    return { allowed: true, reason: null };
  }
  return { allowed: true, reason: null };
}
