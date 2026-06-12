"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/api/fetch-json";
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
import { mergePageUiProjection, type UiProjectionData } from "@/lib/core/ui-projection-data";

function evidenceLabel(status: string | undefined): string {
  if (status === "VALID") return "Evidence valid";
  if (status === "PENDING") return "Evidence pending";
  if (status === "REJECTED") return "Evidence rejected";
  return "Evidence pending";
}

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

export function TradesClient({ initialUi }: { initialUi: UiProjectionData }) {
  const ctx = useUiProjectionData();
  const ui = mergePageUiProjection(initialUi, ctx);
  const [closeTradeId, setCloseTradeId] = useState<string | null>(null);
  const [calculatingId, setCalculatingId] = useState<string | null>(null);

  const closeTrade = ui.trades.open.find((t) => t.tradeId === closeTradeId);
  const pendingPnlCount = ui.trades.closed.filter(
    (t) => t.status === "CLOSED_PENDING_PNL" || t.pnlStatus === "PENDING_DATA",
  ).length;
  const realizedPnlCount = ui.trades.closed.filter((t) => t.pnlStatus === "REALIZED").length;

  async function calculatePnl(tradeId: string) {
    setCalculatingId(tradeId);
    try {
      await fetchJson("/api/pnl/calculate", {
        method: "POST",
        body: JSON.stringify({ tradeId }),
      });
      await ui.reload();
    } finally {
      setCalculatingId(null);
    }
  }
  const evidenceByTrade = new Map(
    (ui.evidence.trades ?? []).map((t) => [t.tradeId, t]),
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

      <div className="ui-dashboard-metrics sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Executions" value={String(ui.mission.totalTrades)} />
        <MetricCard label="Open" value={String(ui.trades.effectiveOpenCount)} />
        <MetricCard label="Closed" value={String(ui.mission.closedTrades)} />
        <MetricCard label="Realized PnL trades" value={String(realizedPnlCount)} />
        <MetricCard label="Pending PnL" value={String(pendingPnlCount)} />
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
                    label={evidenceLabel(evidenceByTrade.get(t.tradeId)?.status)}
                    tone={
                      evidenceByTrade.get(t.tradeId)?.status === "VALID"
                        ? "ok"
                        : evidenceByTrade.get(t.tradeId)?.status === "PENDING"
                          ? "warning"
                          : "neutral"
                    }
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
                    label={evidenceLabel(evidenceByTrade.get(t.tradeId)?.status)}
                    tone={
                      evidenceByTrade.get(t.tradeId)?.status === "VALID"
                        ? "ok"
                        : evidenceByTrade.get(t.tradeId)?.status === "REJECTED"
                          ? "blocked"
                          : "warning"
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
                {(evidenceByTrade.get(t.tradeId)?.missingEvents?.length ?? 0) > 0 ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Missing: {evidenceByTrade.get(t.tradeId)!.missingEvents!.slice(0, 3).join(", ")}
                  </p>
                ) : null}
                {(t.pnlPendingReasons?.length ?? 0) > 0 ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Reasons: {t.pnlPendingReasons?.join(", ")}
                  </p>
                ) : null}
                {t.status === "CLOSED_PENDING_PNL" || t.pnlStatus === "PENDING_DATA" ? (
                  <button
                    type="button"
                    className="btn mt-2"
                    disabled={calculatingId === t.tradeId}
                    onClick={() => void calculatePnl(t.tradeId)}
                  >
                    {calculatingId === t.tradeId ? "Calculating…" : "Calculate PnL"}
                  </button>
                ) : null}
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
