import type { PaperOrder } from "@/lib/paper/paper-order-types";
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  SupabaseConfigError,
} from "./client";

export class SupabasePaperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabasePaperError";
  }
}

function rowFromOrder(order: PaperOrder) {
  return {
    client_id: order.id,
    decision_log_id: order.decisionLogId,
    committee_verdict: order.committeeVerdict,
    instrument: order.instrument,
    symbol: order.symbol,
    side: order.side,
    entry_btc_price: order.entryBtcPrice,
    entry_option_mark: order.entryOptionMark,
    strike: order.strike,
    size_pct: order.sizePct,
    notional_usd: order.notionalUsd,
    status: order.status,
    opened_at: order.openedAt,
    closed_at: order.closedAt,
    exit_btc_price: order.exitBtcPrice,
    realized_pnl_pct: order.realizedPnlPct,
    unrealized_pnl_pct: order.unrealizedPnlPct,
    last_mark_btc_price: order.lastMarkBtcPrice,
    last_mark_at: order.lastMarkAt,
    opened_by: order.openedBy,
    notes: order.notes,
    updated_at: new Date().toISOString(),
  };
}

function orderFromRow(row: Record<string, unknown>): PaperOrder {
  return {
    id: String(row.client_id ?? row.id),
    decisionLogId: String(row.decision_log_id ?? ""),
    committeeVerdict: String(row.committee_verdict ?? "WAIT") as PaperOrder["committeeVerdict"],
    instrument: String(row.instrument ?? "no_trade") as PaperOrder["instrument"],
    symbol: String(row.symbol ?? "BTC"),
    side: String(row.side ?? "none") as PaperOrder["side"],
    entryBtcPrice: Number(row.entry_btc_price ?? 0),
    entryOptionMark:
      row.entry_option_mark != null ? Number(row.entry_option_mark) : null,
    strike: row.strike != null ? Number(row.strike) : null,
    sizePct: Number(row.size_pct ?? 0),
    notionalUsd: Number(row.notional_usd ?? 10_000),
    status: String(row.status ?? "OPEN") as PaperOrder["status"],
    openedAt: String(row.opened_at ?? new Date().toISOString()),
    closedAt: row.closed_at != null ? String(row.closed_at) : null,
    exitBtcPrice: row.exit_btc_price != null ? Number(row.exit_btc_price) : null,
    realizedPnlPct:
      row.realized_pnl_pct != null ? Number(row.realized_pnl_pct) : null,
    unrealizedPnlPct:
      row.unrealized_pnl_pct != null ? Number(row.unrealized_pnl_pct) : null,
    lastMarkAt: row.last_mark_at != null ? String(row.last_mark_at) : null,
    lastMarkBtcPrice:
      row.last_mark_btc_price != null ? Number(row.last_mark_btc_price) : null,
    openedBy: String(row.opened_by ?? "committee_auto") as PaperOrder["openedBy"],
    notes: String(row.notes ?? ""),
    supabaseId: row.id != null ? String(row.id) : undefined,
  };
}

export async function upsertPaperOrdersToSupabase(
  orders: PaperOrder[],
): Promise<number> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseConfigError("Supabase not configured.");
  }
  if (orders.length === 0) return 0;

  const supabase = getSupabaseAdmin();
  const rows = orders.map(rowFromOrder);

  const { error } = await supabase.from("paper_orders").upsert(rows, {
    onConflict: "client_id",
  });

  if (error) throw new SupabasePaperError(error.message);
  return orders.length;
}

export async function fetchPaperOrdersFromSupabase(): Promise<PaperOrder[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("paper_orders")
    .select("*")
    .order("opened_at", { ascending: false })
    .limit(200);

  if (error) throw new SupabasePaperError(error.message);
  if (!data) return [];

  return data.map((row) => orderFromRow(row as Record<string, unknown>));
}
