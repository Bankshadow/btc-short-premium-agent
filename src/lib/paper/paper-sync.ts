import type { PaperOrder, PaperTradingSettings } from "./paper-order-types";

export interface PaperSyncPayload {
  orders: PaperOrder[];
  settings?: PaperTradingSettings;
}

export interface PaperSyncResponse {
  ok: boolean;
  synced: number;
  pulled?: PaperOrder[];
  error?: string;
}

/** Push local paper orders to server (Supabase when configured). */
export async function syncPaperOrdersToServer(
  payload: PaperSyncPayload,
): Promise<PaperSyncResponse> {
  try {
    const response = await fetch("/api/paper/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as PaperSyncResponse;
    if (!response.ok) {
      return { ok: false, synced: 0, error: data.error ?? `HTTP ${response.status}` };
    }
    return data;
  } catch (err) {
    return {
      ok: false,
      synced: 0,
      error: err instanceof Error ? err.message : "Sync failed",
    };
  }
}

export async function pullPaperOrdersFromServer(): Promise<PaperOrder[]> {
  try {
    const response = await fetch("/api/paper/sync", { cache: "no-store" });
    if (!response.ok) return [];
    const data = (await response.json()) as PaperSyncResponse;
    return data.pulled ?? [];
  } catch {
    return [];
  }
}
