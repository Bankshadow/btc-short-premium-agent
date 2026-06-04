import { loadPaperOrders } from "./paper-orders";
import type { PaperOrder, PaperTradingSettings } from "./paper-order-types";

export interface PaperSyncPayload {
  orders: PaperOrder[];
  settings?: PaperTradingSettings;
}

export interface PaperSyncResponse {
  ok: boolean;
  synced: number;
  pulled?: PaperOrder[];
  openOrders?: PaperOrder[];
  syncedAt?: string;
  error?: string;
}

export interface PaperOrdersListResponse {
  ok: boolean;
  openOrders: PaperOrder[];
  orders?: PaperOrder[];
  source?: string;
  message?: string;
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

/** After opening a paper order, push to cloud and return OPEN orders from API. */
export async function syncOpenedPaperOrder(
  order: PaperOrder,
  settings?: PaperTradingSettings,
): Promise<{ openOrders: PaperOrder[]; synced: number; error?: string }> {
  const all = loadPaperOrders();
  const payload: PaperSyncPayload = {
    orders: all.some((o) => o.id === order.id) ? all : [...all, order],
    settings,
  };
  const result = await syncPaperOrdersToServer(payload);
  if (!result.ok) {
    return { openOrders: [order], synced: 0, error: result.error };
  }
  const openOrders =
    result.openOrders?.filter((o) => o.status === "OPEN") ??
    payload.orders.filter((o) => o.status === "OPEN");
  return { openOrders, synced: result.synced, error: result.error };
}

export async function fetchOpenPaperOrdersFromApi(): Promise<PaperOrder[]> {
  try {
    const response = await fetch("/api/paper/orders?status=open", {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = (await response.json()) as PaperOrdersListResponse;
    return data.openOrders ?? [];
  } catch {
    return [];
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
