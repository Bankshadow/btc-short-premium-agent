import type { DeskBackboneRecord } from "../types";

/** Optional cloud sync — delegates to existing warehouse when configured. */
export async function syncBackboneToSupabase(
  record: DeskBackboneRecord,
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Server-side sync not implemented" };
  }

  try {
    const res = await fetch("/api/data-backbone/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    return data.ok ? { ok: true } : { ok: false, error: data.error ?? "Sync failed" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Sync failed",
    };
  }
}

export async function fetchSupabaseBackboneHealth(): Promise<{
  configured: boolean;
  connected: boolean;
}> {
  try {
    const res = await fetch("/api/db/status", { cache: "no-store" });
    if (!res.ok) return { configured: false, connected: false };
    const data = (await res.json()) as {
      supabaseConfigured?: boolean;
      writeHealthy?: boolean;
    };
    return {
      configured: Boolean(data.supabaseConfigured),
      connected: Boolean(data.writeHealthy ?? data.supabaseConfigured),
    };
  } catch {
    return { configured: false, connected: false };
  }
}
