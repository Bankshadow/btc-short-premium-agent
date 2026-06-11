"use client";

import { useState } from "react";
import { Badge, StatCard, useApi } from "@/components/use-api";
import { ProjectionWarningPanel } from "@/components/projection-warning";
import { CloseReviewModal } from "@/components/CloseReviewModal";
import { getDefaultTradeProjection } from "@/lib/core/projection-defaults";

interface TradesResponse {
  open: Array<{
    tradeId: string;
    symbol: string;
    side: string;
    qty: string;
    notionalUsd: number;
    orderId: string;
    entryPrice: number | null;
    decisionLogId: string;
    openedAt: string;
    environment: string;
    source: string;
    position: {
      side: string;
      qty: string;
      entryPrice: number | null;
      markPrice: number | null;
      unrealizedPnl: number | null;
      refreshedAt: string;
      status: string;
    } | null;
    closePreview: {
      closePreviewId: string;
      status: string;
      sideToClose: string;
      qty: string;
      blocked: boolean;
      blockReasons: string[];
      expiresAt: string;
      reduceOnly: boolean;
    } | null;
  }>;
  closed: Array<{
    tradeId: string;
    symbol: string;
    side: string;
    netPnl: number;
    result: string;
    learningId: string | null;
    status: string;
    closeOrderId: string | null;
    decisionLogId: string | null;
    closedAt: string;
  }>;
  summary: {
    openCount: number;
    closedCount: number;
    realizedPnl: number;
    executionCount: number;
  };
}

export default function TradesPage() {
  const fallback = getDefaultTradeProjection();
  const { data, error, reload } = useApi<TradesResponse>("/api/core/projections/trades", 0, {
    fallback,
  });
  const [closeTradeId, setCloseTradeId] = useState<string | null>(null);

  const tradeData = data ?? fallback;
  const closeTrade = tradeData.open.find((t) => t.tradeId === closeTradeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Trades</h2>
        <button type="button" className="btn" onClick={reload}>
          Refresh
        </button>
      </div>

      <ProjectionWarningPanel
        warnings={error ? [`trades projection: ${error}`] : []}
        onRetry={reload}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Executions" value={String(tradeData.summary.executionCount)} />
        <StatCard label="Open" value={String(tradeData.summary.openCount)} />
        <StatCard label="Closed" value={String(tradeData.summary.closedCount)} />
        <StatCard label="Realized PnL" value={`$${tradeData.summary.realizedPnl.toFixed(2)}`} />
      </div>

      <div className="panel">
        <h3 className="mb-3 font-semibold">Open testnet trades</h3>
        {tradeData.open.length === 0 ? (
          <p className="empty-state">No open trades.</p>
        ) : (
          <div className="space-y-2">
            {tradeData.open.map((t) => (
              <div key={t.tradeId} className="rounded border border-[var(--border)] p-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="safe">{t.environment}</Badge>
                  <Badge tone="wait">{t.source}</Badge>
                  {t.position ? (
                    <Badge tone={t.position.status === "OPEN" ? "safe" : "wait"}>
                      {t.position.status}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 font-medium">
                  {t.symbol} {t.side} · qty {t.qty} · ${t.notionalUsd}
                </p>
                <p className="text-[var(--muted)]">
                  orderId {t.orderId}
                  {t.entryPrice != null ? ` · entry ${t.entryPrice}` : ""}
                </p>
                {t.position ? (
                  <p className="text-[var(--muted)]">
                    mark {t.position.markPrice ?? "—"} · unrealized PnL{" "}
                    {t.position.unrealizedPnl != null
                      ? `$${t.position.unrealizedPnl.toFixed(4)}`
                      : "—"}{" "}
                    · refreshed {new Date(t.position.refreshedAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-[var(--muted)]">Position not monitored — refresh from Dashboard.</p>
                )}
                <p className="text-[var(--muted)]">
                  opened {new Date(t.openedAt).toLocaleString()}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  tradeId: {t.tradeId} · decisionLogId: {t.decisionLogId}
                </p>
                {t.closePreview ? (
                  <div className="mt-2 rounded border border-[var(--border)] p-2 text-xs">
                    <p className="font-medium">Close preview: {t.closePreview.status}</p>
                    <p>
                      Close {t.closePreview.sideToClose} · qty {t.closePreview.qty} · reduceOnly{" "}
                      {String(t.closePreview.reduceOnly)}
                    </p>
                    {t.closePreview.blocked ? (
                      <p className="text-[var(--danger)]">
                        Blocked: {t.closePreview.blockReasons.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary mt-2"
                  onClick={() => setCloseTradeId(t.tradeId)}
                >
                  Review close
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h3 className="mb-3 font-semibold">Closed trades</h3>
        {tradeData.closed.length === 0 ? (
          <p className="empty-state">No closed trades yet.</p>
        ) : (
          <div className="space-y-2">
            {tradeData.closed.map((t) => (
              <div key={t.tradeId} className="rounded border border-[var(--border)] p-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={t.result === "WIN" ? "safe" : t.result === "LOSS" ? "blocked" : "wait"}>
                    {t.result}
                  </Badge>
                  {t.learningId ? (
                    <Badge tone="safe">Learning recorded</Badge>
                  ) : t.status === "CLOSED" ? (
                    <Badge tone="wait">Learning pending</Badge>
                  ) : null}
                </div>
                <p className="mt-2 font-medium">
                  {t.symbol} {t.side}
                  {t.status === "CLOSED_PENDING_PNL"
                    ? " · PnL pending data"
                    : ` · $${t.netPnl.toFixed(2)} net`}
                </p>
                {t.closeOrderId ? (
                  <p className="text-[var(--muted)]">close orderId {t.closeOrderId}</p>
                ) : null}
                <p className="text-[var(--muted)]">{new Date(t.closedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {closeTrade ? (
        <CloseReviewModal
          tradeId={closeTrade.tradeId}
          symbol={closeTrade.symbol}
          side={closeTrade.side}
          qty={closeTrade.qty}
          onClose={() => setCloseTradeId(null)}
          onReviewed={reload}
        />
      ) : null}
    </div>
  );
}
