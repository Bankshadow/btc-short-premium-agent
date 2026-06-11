"use client";

import { useState } from "react";
import { CloseReviewModal } from "@/components/CloseReviewModal";
import { useUiProjectionData } from "@/components/use-projection-bundle";
import {
  MetricCard,
  PageHeader,
  ProjectionWarning,
  SafetyLabelsBar,
  SectionCard,
  StatusBadge,
} from "@/components/ui";
import { PROJECTION_FALLBACK_ACTIVE_MESSAGE } from "@/lib/core/projection-defaults";
import { PNL_PENDING_LABEL, staleTradeBannerText } from "@/lib/core/stale-trade-display";

function pnlStatusLabel(trade: {
  status: string;
  result: string;
  pnlStatus?: string;
}): string {
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
  const ui = useUiProjectionData();
  const [closeTradeId, setCloseTradeId] = useState<string | null>(null);

  const closeTrade = ui.trades.open.find((t) => t.tradeId === closeTradeId);
  const evidenceByTrade = new Map(
    (ui.evidence.trades ?? []).map((t) => [t.tradeId, t.status]),
  );
  const showFallbackWarning = ui.isFallback && !ui.loading;

  return (
    <div className="ui-dashboard-grid">
      <PageHeader
        title="Trades"
        description="Trade projection — journal-derived open/closed state"
        actions={
          <button type="button" className="btn" onClick={() => ui.reload()}>
            Refresh
          </button>
        }
      />
      <SafetyLabelsBar />
      <ProjectionWarning
        warnings={
          showFallbackWarning
            ? [PROJECTION_FALLBACK_ACTIVE_MESSAGE, ...ui.warnings]
            : ui.warnings
        }
        onRetry={ui.reload}
      />

      <div className="ui-dashboard-metrics sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Executions" value={String(ui.mission.totalTrades)} />
        <MetricCard label="Open" value={String(ui.trades.effectiveOpenCount)} />
        <MetricCard label="Closed" value={String(ui.mission.closedTrades)} />
        <MetricCard label="Realized PnL" value={`$${ui.mission.netPnl.toFixed(2)}`} />
      </div>

      {ui.trades.staleOpenWarnings.length > 0 ? (
        <SectionCard title="Stale trade reconciliation" addon="WARNING" tone="warning">
          <p className="text-sm text-[var(--muted)]">
            {staleTradeBannerText(ui.trades.staleOpenWarnings.length)}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {ui.trades.staleOpenWarnings.map((w) => (
              <li key={w.tradeId}>
                {w.tradeId} → {w.projectedStatus}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard title="Open testnet trades">
        {ui.trades.open.length === 0 ? (
          <p className="empty-state">
            {ui.loading ? "Loading trades projection…" : "No open trades."}
          </p>
        ) : (
          <div className="space-y-3">
            {ui.trades.open.map((t) => (
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
        {ui.trades.closed.length === 0 ? (
          <p className="empty-state">
            {ui.loading
              ? "Loading closed trades…"
              : showFallbackWarning
                ? "Projection unavailable — retry refresh."
                : "No closed trades yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {ui.trades.closed.map((t) => (
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
          onReviewed={ui.reload}
        />
      ) : null}
    </div>
  );
}
