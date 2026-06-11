"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/components/use-api";
import { CloseReviewModal } from "@/components/CloseReviewModal";
import { useProjectionBundle } from "@/components/use-projection-bundle";
import {
  MetricCard,
  PageHeader,
  ProjectionWarning,
  SafetyLabelsBar,
  SectionCard,
  StatusBadge,
} from "@/components/ui";
import { getDefaultTradeProjection } from "@/lib/core/projection-defaults";
import { PNL_PENDING_LABEL, staleTradeBannerText } from "@/lib/core/stale-trade-display";

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
    pnlStatus?: string;
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
  staleOpenWarnings?: Array<{ tradeId: string; projectedStatus: string }>;
}

function pnlStatusLabel(trade: TradesResponse["closed"][number]): string {
  if (trade.status === "CLOSED_PENDING_PNL" || trade.result === "PENDING_PNL") {
    return "PENDING_PNL";
  }
  if (trade.pnlStatus === "PENDING_DATA") return "PENDING_PNL";
  return "PNL_REALIZED";
}

function lifecycleLabel(open: boolean, hasClosePreview: boolean): string {
  if (open && hasClosePreview) return "Close preview";
  if (open) return "Monitor";
  return "Closed";
}

export default function TradesPage() {
  const fallback = useMemo(() => getDefaultTradeProjection(), []);
  const { trades: bundleTrades, evidence, warnings: bundleWarnings, reload: reloadBundle } =
    useProjectionBundle();
  const { data, error, reload } = useApi<TradesResponse>("/api/core/projections/trades", 0, {
    fallback,
  });
  const [closeTradeId, setCloseTradeId] = useState<string | null>(null);

  const tradeData = useMemo((): TradesResponse => {
    if (data?.summary) return data;
    if (!bundleTrades.zeroState) {
      return {
        open: bundleTrades.open as TradesResponse["open"],
        closed: bundleTrades.closed as TradesResponse["closed"],
        summary: {
          openCount: bundleTrades.openCount,
          closedCount: bundleTrades.closedCount,
          realizedPnl:
            "summary" in bundleTrades && bundleTrades.summary
              ? bundleTrades.summary.realizedPnl
              : 0,
          executionCount: bundleTrades.totalTrades,
        },
        staleOpenWarnings: bundleTrades.staleOpenWarnings,
      };
    }
    return data ?? fallback;
  }, [bundleTrades, data, fallback]);
  const closeTrade = tradeData.open.find((t) => t.tradeId === closeTradeId);
  const evidenceByTrade = new Map(
    (evidence.trades ?? []).map((t) => [t.tradeId, t.status]),
  );

  return (
    <div className="ui-dashboard-grid">
      <PageHeader
        title="Trades"
        description="Trade projection — journal-derived open/closed state"
        actions={
          <button
            type="button"
            className="btn"
            onClick={() => {
              reloadBundle();
              reload();
            }}
          >
            Refresh
          </button>
        }
      />
      <SafetyLabelsBar />
      <ProjectionWarning
        warnings={[...bundleWarnings, ...(error ? [`trades: ${error}`] : [])]}
        onRetry={reload}
      />

      <div className="ui-dashboard-metrics sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Executions" value={String(tradeData.summary.executionCount)} />
        <MetricCard label="Open" value={String(tradeData.summary.openCount)} />
        <MetricCard label="Closed" value={String(tradeData.summary.closedCount)} />
        <MetricCard label="Realized PnL" value={`$${tradeData.summary.realizedPnl.toFixed(2)}`} />
      </div>

      {(tradeData.staleOpenWarnings?.length ?? 0) > 0 ? (
        <SectionCard title="Stale trade reconciliation" addon="WARNING" tone="warning">
          <p className="text-sm text-[var(--muted)]">
            {staleTradeBannerText(tradeData.staleOpenWarnings!.length)}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {tradeData.staleOpenWarnings!.map((w) => (
              <li key={w.tradeId}>
                {w.tradeId} → {w.projectedStatus}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard title="Open testnet trades">
        {tradeData.open.length === 0 ? (
          <p className="empty-state">No open trades.</p>
        ) : (
          <div className="space-y-3">
            {tradeData.open.map((t) => (
              <div key={t.tradeId} className="rounded border border-[var(--border)] p-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={lifecycleLabel(true, Boolean(t.closePreview))} tone="warning" />
                  <StatusBadge
                    label={evidenceByTrade.get(t.tradeId) ?? "PENDING"}
                    tone={evidenceByTrade.get(t.tradeId) === "VALID" ? "ok" : "neutral"}
                  />
                  {t.position ? (
                    <StatusBadge
                      label={t.position.status}
                      tone={t.position.status === "OPEN" ? "ok" : "warning"}
                    />
                  ) : null}
                </div>
                <p className="mt-2 font-medium">
                  {t.symbol} {t.side} · qty {t.qty}
                </p>
                <p className="text-[var(--muted)]">
                  orderId {t.orderId}
                  {t.entryPrice != null ? ` · entry ${t.entryPrice}` : ""}
                </p>
                {t.position ? (
                  <p className="text-[var(--muted)]">
                    mark {t.position.markPrice ?? "—"} · uPnL{" "}
                    {t.position.unrealizedPnl != null ? `$${t.position.unrealizedPnl.toFixed(4)}` : "—"}
                  </p>
                ) : null}
                <button type="button" className="btn btn-primary mt-2" onClick={() => setCloseTradeId(t.tradeId)}>
                  Review close
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Closed trades">
        {tradeData.closed.length === 0 ? (
          <p className="empty-state">No closed trades yet.</p>
        ) : (
          <div className="space-y-3">
            {tradeData.closed.map((t) => (
              <div key={t.tradeId} className="rounded border border-[var(--border)] p-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    label={pnlStatusLabel(t)}
                    tone={pnlStatusLabel(t) === "PNL_REALIZED" ? "ok" : "warning"}
                  />
                  <StatusBadge
                    label={evidenceByTrade.get(t.tradeId) ?? "PENDING"}
                    tone={
                      evidenceByTrade.get(t.tradeId) === "VALID"
                        ? "ok"
                        : evidenceByTrade.get(t.tradeId) === "REJECTED"
                          ? "blocked"
                          : "neutral"
                    }
                  />
                  <StatusBadge
                    label={t.result}
                    tone={t.result === "WIN" ? "ok" : t.result === "LOSS" ? "blocked" : "warning"}
                  />
                </div>
                <p className="mt-2 font-medium">
                  {t.symbol} {t.side}
                  {t.status === "CLOSED_PENDING_PNL" ||
                  t.result === "PENDING_PNL" ||
                  t.pnlStatus === "PENDING_DATA"
                    ? ` · ${PNL_PENDING_LABEL}`
                    : ` · $${t.netPnl.toFixed(2)} net`}
                </p>
                <p className="text-xs text-[var(--muted)]">{t.tradeId}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

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
