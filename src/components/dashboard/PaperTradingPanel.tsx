"use client";

import type { PaperOrder, PaperTradingSettings } from "@/lib/paper/paper-order-types";
import type { PaperMode } from "@/lib/paper/paper-relaxed-types";
import { PAPER_ACCOUNT_NOTIONAL_USD } from "@/lib/paper/paper-order-types";
import { computeRelaxedPaperAnalytics } from "@/lib/paper/paper-relaxed-analytics";
import { isRelaxedPaperMode } from "@/lib/paper/paper-relaxed-gate";
import { formatUsd } from "./utils";
import { useMemo, useState } from "react";

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
  const relaxed = order.paperMode === "RELAXED_PAPER";

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        relaxed
          ? "border-amber-800/50 bg-amber-950/20"
          : "border-zinc-800 bg-zinc-950/60"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-zinc-200">
            {order.instrument.replace(/_/g, " ")} · {order.symbol}
            {relaxed && (
              <span className="ml-2 rounded bg-amber-900/60 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-200">
                Relaxed
              </span>
            )}
          </p>
          <p className="text-[10px] text-zinc-500">
            {order.status} ·{" "}
            {order.openedBy === "relaxed_auto"
              ? "Relaxed auto"
              : order.openedBy === "committee_auto"
                ? "AI desk"
                : order.openedBy === "operator_approved"
                  ? "Operator approved"
                  : "Manual"}{" "}
            · size {order.sizePct}%
          </p>
          {relaxed && order.relaxedReason && (
            <p className="mt-0.5 text-[10px] text-amber-200/70">
              {order.relaxedReason}
            </p>
          )}
          {relaxed && order.strictVerdict && (
            <p className="text-[10px] text-zinc-600">
              Strict would be {order.strictVerdict} → relaxed {order.relaxedVerdict}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className={`font-mono text-sm font-semibold ${pnlClass(pnl)}`}>
            {pnl >= 0 ? "+" : ""}
            {pnl}%
          </p>
          <p className="font-mono text-[10px] text-zinc-500">
            ≈ {usd >= 0 ? "+" : ""}${usd.toFixed(0)} on $
            {(order.notionalUsd / 1000).toFixed(0)}k
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
  const relaxedActive = isRelaxedPaperMode(settings);
  const analytics = useMemo(
    () => computeRelaxedPaperAnalytics(orders),
    [orders],
  );

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
        <h2 className="text-sm font-semibold text-zinc-100">
          Paper trading · AI linked
        </h2>
        {relaxedActive && (
          <p className="mt-2 rounded border border-amber-700/50 bg-amber-950/40 px-2 py-1 text-[11px] font-semibold text-amber-200">
            Paper Relaxed — learning mode only · no live execution
          </p>
        )}
        <p className="mt-0.5 text-[10px] text-zinc-500">
          {settings.paperMode === "STRICT_PAPER"
            ? "Strict: committee TRADE only"
            : "Relaxed: playbook / options-aligned paper entries for learning"}
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

      <div className="border-t border-zinc-800 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Paper mode settings
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-400">
            Mode
            <select
              value={settings.paperMode}
              onChange={(e) =>
                onSettingsChange({ paperMode: e.target.value as PaperMode })
              }
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
            >
              <option value="STRICT_PAPER">Strict paper (committee TRADE)</option>
              <option value="RELAXED_PAPER">Relaxed paper (learning)</option>
            </select>
          </label>
          <label className="text-xs text-zinc-400">
            Relaxed min confidence
            <input
              type="number"
              min={40}
              max={90}
              value={settings.relaxedMinConfidence}
              disabled={!relaxedActive}
              onChange={(e) =>
                onSettingsChange({
                  relaxedMinConfidence: Number(e.target.value) || 52,
                })
              }
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-200 disabled:opacity-40"
            />
          </label>
          <label className="text-xs text-zinc-400">
            Relaxed max size %
            <input
              type="number"
              min={0.5}
              max={5}
              step={0.5}
              value={settings.relaxedMaxPositionSizePct}
              disabled={!relaxedActive}
              onChange={(e) =>
                onSettingsChange({
                  relaxedMaxPositionSizePct: Number(e.target.value) || 1,
                })
              }
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-200 disabled:opacity-40"
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[10px]">
          <label className="flex items-center gap-1.5 text-zinc-400">
            <input
              type="checkbox"
              checked={settings.autoCreatePaperOnTrade ?? settings.autoOpenOnTrade}
              onChange={(e) =>
                onSettingsChange({
                  autoCreatePaperOnTrade: e.target.checked,
                  autoOpenOnTrade: e.target.checked,
                })
              }
            />
            Auto-create paper trade on TRADE verdict
          </label>
          <label className="flex items-center gap-1.5 text-zinc-400">
            <input
              type="checkbox"
              checked={settings.autoCreateShadowOnWaitSkip ?? false}
              onChange={(e) =>
                onSettingsChange({ autoCreateShadowOnWaitSkip: e.target.checked })
              }
            />
            Auto-create shadow trade on WAIT/SKIP
          </label>
          <label className="flex items-center gap-1.5 text-zinc-400">
            <input
              type="checkbox"
              checked={settings.relaxedAllowWaitToPaperTrade}
              disabled={!relaxedActive}
              onChange={(e) =>
                onSettingsChange({
                  relaxedAllowWaitToPaperTrade: e.target.checked,
                })
              }
            />
            Allow playbook WAIT → paper
          </label>
          <label className="flex items-center gap-1.5 text-zinc-400">
            <input
              type="checkbox"
              checked={settings.relaxedRequireOptionsAgentAgree}
              disabled={!relaxedActive}
              onChange={(e) =>
                onSettingsChange({
                  relaxedRequireOptionsAgentAgree: e.target.checked,
                })
              }
            />
            Require options agent TRADE
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
        </div>
      </div>

      {analytics.relaxedEntered > 0 && (
        <div className="border-t border-amber-900/30 bg-amber-950/10 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">
            Relaxed vs strict analytics
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <p className="text-xs text-zinc-400">
              Strict would skip:{" "}
              <span className="font-mono text-amber-200">
                {analytics.strictWouldHaveSkipped}
              </span>
            </p>
            <p className="text-xs text-zinc-400">
              Relaxed entered:{" "}
              <span className="font-mono text-amber-200">
                {analytics.relaxedEntered}
              </span>
            </p>
            <p className="text-xs text-zinc-400">
              Relaxed win rate:{" "}
              <span className="font-mono text-amber-200">
                {analytics.relaxedWinRate}%
              </span>
            </p>
            <p className="text-xs text-zinc-400">
              Regret score:{" "}
              <span className="font-mono text-amber-200">
                {analytics.relaxedRegretScore}%
              </span>
            </p>
            <p className="text-xs text-zinc-400">
              Avg relaxed PnL:{" "}
              <span className={`font-mono ${pnlClass(analytics.avgRelaxedPnlPct)}`}>
                {analytics.avgRelaxedPnlPct}%
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-zinc-800 px-4 py-2 text-[10px]">
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
        {syncStatus && <span className="text-zinc-600">{syncStatus}</span>}
      </div>

      <div className="space-y-2 px-4 pb-4">
        {settings.syncSupabase && syncedOpenOrders.length > 0 && (
          <p className="text-[10px] text-emerald-600/90">
            API sync: {syncedOpenOrders.length} open order(s) on server
          </p>
        )}

        {openOrders.length === 0 ? (
          <p className="text-xs text-zinc-600">
            No open paper positions — next eligible signal will open one (if
            auto-open enabled).
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
