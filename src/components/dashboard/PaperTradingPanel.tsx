"use client";

import type { PaperOrder, PaperTradingSettings } from "@/lib/paper/paper-order-types";
import { PAPER_ACCOUNT_NOTIONAL_USD } from "@/lib/paper/paper-order-types";
import { formatUsd } from "./utils";
import { useState } from "react";

interface PaperTradingPanelProps {
  orders: PaperOrder[];
  openOrders: PaperOrder[];
  summary: {
    openCount: number;
    closedCount: number;
    totalRealizedPnlPct: number;
    totalUnrealizedPnlPct: number;
    winCount: number;
    lossCount: number;
  };
  settings: PaperTradingSettings;
  syncStatus: string | null;
  /** OPEN orders from GET /api/paper/orders after sync */
  syncedOpenOrders?: PaperOrder[];
  currentBtcPrice: number;
  onSettingsChange: (patch: Partial<PaperTradingSettings>) => void;
  onCloseOrder: (
    orderId: string,
    input: { exitBtcPrice: number; notes?: string },
  ) => void | Promise<void>;
  onSync: () => void | Promise<void>;
  onPull: () => void | Promise<void>;
}

function pnlClass(pnl: number): string {
  if (pnl > 0) return "text-emerald-400";
  if (pnl < 0) return "text-rose-400";
  return "text-zinc-400";
}

function OrderRow({
  order,
  currentBtcPrice,
  onClose,
}: {
  order: PaperOrder;
  currentBtcPrice: number;
  onClose: (orderId: string, exitBtc: number) => void;
}) {
  const pnl =
    order.status === "OPEN"
      ? (order.unrealizedPnlPct ?? 0)
      : (order.realizedPnlPct ?? 0);
  const usd =
    (PAPER_ACCOUNT_NOTIONAL_USD * (order.sizePct / 100) * pnl) / 100;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-zinc-200">
            {order.instrument.replace(/_/g, " ")} · {order.symbol}
          </p>
          <p className="text-[10px] text-zinc-500">
            {order.status} ·{" "}
            {order.openedBy === "committee_auto"
              ? "AI desk"
              : order.openedBy === "operator_approved"
                ? "Operator approved"
                : "Manual"}{" "}
            ·
            size {order.sizePct}%
          </p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-sm font-semibold ${pnlClass(pnl)}`}>
            {pnl >= 0 ? "+" : ""}
            {pnl}%
          </p>
          <p className="font-mono text-[10px] text-zinc-500">
            ≈ {usd >= 0 ? "+" : ""}${usd.toFixed(0)} on ${(order.notionalUsd / 1000).toFixed(0)}k
          </p>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">
        Entry BTC {formatUsd(order.entryBtcPrice)}
        {order.strike != null && ` · strike ${formatUsd(order.strike)}`}
        {order.exitBtcPrice != null && ` → exit ${formatUsd(order.exitBtcPrice)}`}
      </p>
      {order.status === "OPEN" && (
        <button
          type="button"
          onClick={() => onClose(order.id, currentBtcPrice)}
          className="mt-2 rounded bg-amber-700/80 px-2.5 py-1 text-[10px] font-semibold text-zinc-950 hover:bg-amber-600"
        >
          Close @ tape {formatUsd(currentBtcPrice)}
        </button>
      )}
    </div>
  );
}

export default function PaperTradingPanel({
  openOrders,
  orders,
  summary,
  settings,
  syncStatus,
  syncedOpenOrders = [],
  currentBtcPrice,
  onSettingsChange,
  onCloseOrder,
  onSync,
  onPull,
}: PaperTradingPanelProps) {
  const [closingId, setClosingId] = useState<string | null>(null);

  const handleClose = async (orderId: string, exitBtc: number) => {
    setClosingId(orderId);
    try {
      await onCloseOrder(orderId, {
        exitBtcPrice: exitBtc,
        notes: `Closed at market tape ${exitBtc}`,
      });
    } finally {
      setClosingId(null);
    }
  };

  return (
    <section className="desk-panel border-emerald-900/40">
      <div className="border-b border-zinc-800 px-4 py-3">
        <p className="desk-section-title text-emerald-500/80">Execution desk</p>
        <h2 className="text-sm font-semibold text-zinc-100">Paper trading · AI linked</h2>
        <p className="mt-0.5 text-[10px] text-zinc-500">
          Committee TRADE auto-opens paper · sync via POST /api/paper/sync · list via GET /api/paper/orders?status=open
        </p>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-4">
        <div className="rounded-lg bg-zinc-950/80 px-3 py-2">
          <p className="desk-section-title">Open</p>
          <p className="font-mono text-lg text-zinc-100">{summary.openCount}</p>
        </div>
        <div className="rounded-lg bg-zinc-950/80 px-3 py-2">
          <p className="desk-section-title">Realized</p>
          <p className={`font-mono text-lg ${pnlClass(summary.totalRealizedPnlPct)}`}>
            {summary.totalRealizedPnlPct >= 0 ? "+" : ""}
            {summary.totalRealizedPnlPct}%
          </p>
        </div>
        <div className="rounded-lg bg-zinc-950/80 px-3 py-2">
          <p className="desk-section-title">Unrealized</p>
          <p className={`font-mono text-lg ${pnlClass(summary.totalUnrealizedPnlPct)}`}>
            {summary.totalUnrealizedPnlPct >= 0 ? "+" : ""}
            {summary.totalUnrealizedPnlPct}%
          </p>
        </div>
        <div className="rounded-lg bg-zinc-950/80 px-3 py-2">
          <p className="desk-section-title">W / L</p>
          <p className="font-mono text-lg text-zinc-100">
            {summary.winCount} / {summary.lossCount}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-zinc-800 px-4 py-2 text-[10px]">
        <label className="flex items-center gap-1.5 text-zinc-400">
          <input
            type="checkbox"
            checked={settings.autoOpenOnTrade}
            onChange={(e) =>
              onSettingsChange({ autoOpenOnTrade: e.target.checked })
            }
          />
          Auto-open on committee TRADE
        </label>
        <label className="flex items-center gap-1.5 text-zinc-400">
          <input
            type="checkbox"
            checked={settings.autoMarkToMarket}
            onChange={(e) =>
              onSettingsChange({ autoMarkToMarket: e.target.checked })
            }
          />
          Mark-to-market each session
        </label>
        <label className="flex items-center gap-1.5 text-zinc-400">
          <input
            type="checkbox"
            checked={settings.syncSupabase}
            onChange={(e) => onSettingsChange({ syncSupabase: e.target.checked })}
          />
          Sync orders to cloud
        </label>
        <button
          type="button"
          onClick={() => void onSync()}
          className="text-amber-500 hover:underline"
        >
          Push sync
        </button>
        <button
          type="button"
          onClick={() => void onPull()}
          className="text-zinc-500 hover:underline"
        >
          Pull
        </button>
        {syncStatus && (
          <span className="text-zinc-600">{syncStatus}</span>
        )}
      </div>

      <div className="space-y-2 px-4 pb-4">
        {settings.syncSupabase && syncedOpenOrders.length > 0 && (
          <p className="text-[10px] text-emerald-600/90">
            API sync: {syncedOpenOrders.length} open order(s) on server
          </p>
        )}

        {openOrders.length === 0 ? (
          <p className="text-xs text-zinc-600">
            No open paper positions — next committee TRADE will open one (if auto-open enabled).
          </p>
        ) : (
          openOrders.map((order) => (
            <div
              key={order.id}
              className={closingId === order.id ? "opacity-50" : ""}
            >
              <OrderRow
                order={order}
                currentBtcPrice={currentBtcPrice}
                onClose={handleClose}
              />
            </div>
          ))
        )}

        {orders.filter((o) => o.status === "CLOSED").slice(0, 5).length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[10px] text-zinc-500">
              Recent closed ({summary.closedCount})
            </summary>
            <div className="mt-2 space-y-2">
              {orders
                .filter((o) => o.status === "CLOSED")
                .slice(0, 8)
                .map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    currentBtcPrice={currentBtcPrice}
                    onClose={() => {}}
                  />
                ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
