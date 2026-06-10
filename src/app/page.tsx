"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/api/fetch-json";
import { Badge, LoadingOrError, StatCard, useApi } from "@/components/use-api";
import { ExecutionReviewModal } from "@/components/ExecutionReviewModal";
import { CloseReviewModal } from "@/components/CloseReviewModal";
import type { MissionSnapshotView } from "@/types/mission";

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, error, loading, reload } = useApi<MissionSnapshotView>(
    "/api/mission/snapshot",
    refreshKey,
  );
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [showExecutionReview, setShowExecutionReview] = useState(false);
  const [showCloseReview, setShowCloseReview] = useState(false);
  const [refreshingPosition, setRefreshingPosition] = useState(false);

  async function startAi() {
    setRunning(true);
    setRunError(null);
    try {
      await fetchJson("/api/analysis/run", { method: "POST" });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Start AI failed");
    } finally {
      setRunning(false);
    }
  }

  function refresh() {
    setRefreshKey((k) => k + 1);
    void reload();
  }

  async function refreshPosition() {
    setRefreshingPosition(true);
    try {
      await fetchJson("/api/positions/refresh", { method: "POST" });
      refresh();
    } finally {
      setRefreshingPosition(false);
    }
  }

  const pending = LoadingOrError({ loading, error, onRetry: refresh });
  if (pending) return pending;
  if (!data) return <p className="empty-state">No snapshot data.</p>;

  const preview = data.latestPreview;
  const safetyTone =
    data.executionSafetyStatus === "ready"
      ? "safe"
      : data.executionSafetyStatus === "no_preview"
        ? "wait"
        : "blocked";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-sm text-[var(--muted)]">
            MVP 11 · Mission ${data.startCapital.toLocaleString()} → $
            {data.targetCapital.toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={running} onClick={startAi}>
            {running ? "Running…" : "Start AI"}
          </button>
          <button type="button" className="btn" onClick={refresh}>
            Refresh
          </button>
        </div>
      </div>

      {runError ? <div className="error-box">{runError}</div> : null}

      {data.readyForMvp5 === false && data.readyForMvp5Message ? (
        <div className="panel border border-[var(--border)] text-sm text-[var(--muted)]">
          {data.readyForMvp5Message}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Current equity" value={`$${data.currentEquity.toLocaleString()}`} />
        <StatCard label="Progress" value={`${data.progressPct}%`} />
        <StatCard label="Net PnL" value={`$${data.netPnl.toFixed(2)}`} />
        <StatCard
          label="Evidence"
          value={`${data.evidenceProgress?.valid ?? data.totalTrades}/12`}
        />
        <StatCard label="Open" value={String(data.openPositions)} />
        <StatCard label="Trades closed" value={String(data.totalTrades)} />
        <StatCard label="Win / Loss" value={`${data.win}/${data.loss}/${data.breakeven ?? 0}`} />
        <StatCard label="Regime" value={data.latestRegime ?? "UNKNOWN"} />
        <StatCard label="Portfolio risk" value={data.portfolioRiskStatus ?? "OK"} />
        <StatCard label="Exec safety" value={data.executionSafetyStatus ?? "no_preview"} />
        <StatCard
          label="Engine health"
          value={data.engineHealth?.status ?? "OK"}
          sub={data.engineHealth?.blocksExecution ? "execution blocked" : undefined}
        />
        <StatCard
          label="Binance"
          value={data.binanceStatus?.status ?? "MISSING_ENV"}
          sub={data.binanceStatus?.baseUrl ?? "https://demo-fapi.binance.com"}
        />
      </div>

      {data.noTradeBlockReason ? (
        <div className="panel text-sm text-[var(--danger)]">
          No-trade rule: {data.noTradeBlockReason}
        </div>
      ) : null}

      {data.swarmReport ? (
        <div className="panel text-sm">
          <p>
            <span className="text-[var(--muted)]">Scenario swarm:</span>{" "}
            {data.swarmReport.likelyScenario} · signal{" "}
            <strong>{data.swarmReport.advisorySignal}</strong> ·{" "}
            {data.swarmReport.recommendedAction}
          </p>
          <p className="text-xs text-[var(--muted)]">{data.swarmReport.safetyNote}</p>
        </div>
      ) : null}

      <div className="panel grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p>
          <span className="text-[var(--muted)]">Latest run:</span>{" "}
          {data.latestRunId ?? "—"}
        </p>
        <p>
          <span className="text-[var(--muted)]">Decision log:</span>{" "}
          {data.latestDecisionLogId ?? "—"}
        </p>
        <p>
          <span className="text-[var(--muted)]">Latest preview:</span>{" "}
          {preview?.previewId ?? "—"}
        </p>
        <p>
          <span className="text-[var(--muted)]">Next action:</span> {data.nextAction ?? "—"}
        </p>
      </div>

      {data.binanceStatus ? (
        <div className="panel space-y-2 text-sm">
          <p>
            Testnet: <strong>{data.binanceStatus.status}</strong> · Proxy{" "}
            {data.binanceStatus.proxyEnabled ? "on" : "off"} · Keys{" "}
            {data.binanceStatus.apiKeyPresent && data.binanceStatus.apiSecretPresent
              ? "present"
              : "missing"}
          </p>
          <p className="text-[var(--muted)]">{data.binanceStatus.reason}</p>
        </div>
      ) : null}

      {data.latestOpenTrade ? (
        <div className="panel space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Open position</h3>
            {data.reconciliation ? (
              <Badge
                tone={
                  data.reconciliation.status === "OK"
                    ? "safe"
                    : data.reconciliation.status === "WARNING"
                      ? "wait"
                      : "blocked"
                }
              >
                Reconciliation: {data.reconciliation.status}
              </Badge>
            ) : null}
          </div>
          {data.latestPosition ? (
            <>
              <p className="text-sm font-medium">
                {data.latestPosition.symbol} {data.latestPosition.side} · qty{" "}
                {data.latestPosition.qty}
              </p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  Entry:{" "}
                  {data.latestPosition.entryPrice != null
                    ? data.latestPosition.entryPrice
                    : "—"}
                </p>
                <p>
                  Mark:{" "}
                  {data.latestPosition.markPrice != null ? data.latestPosition.markPrice : "—"}
                </p>
                <p>
                  Unrealized PnL:{" "}
                  {data.latestPosition.unrealizedPnl != null
                    ? `$${data.latestPosition.unrealizedPnl.toFixed(4)}`
                    : "—"}
                </p>
                <p className="text-[var(--muted)]">
                  Refreshed:{" "}
                  {new Date(data.latestPosition.refreshedAt).toLocaleString()} ·{" "}
                  {data.latestPosition.status}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              {data.latestOpenTrade.symbol} {data.latestOpenTrade.side} · qty{" "}
              {data.latestOpenTrade.qty} — refresh to sync with Binance.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn"
              disabled={refreshingPosition}
              onClick={refreshPosition}
            >
              {refreshingPosition ? "Refreshing…" : "Refresh position"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCloseReview(true)}
            >
              Review close
            </button>
          </div>
        </div>
      ) : null}

      {!data.latestOpenTrade && data.openPositions === 0 && data.latestClosedTrade ? (
        <div className="panel space-y-2 border border-[var(--success)]/30">
          <h3 className="font-semibold text-[var(--success)]">Latest closed trade</h3>
          <div className="flex flex-wrap gap-2">
            <Badge
              tone={
                data.latestClosedTrade.result === "WIN"
                  ? "safe"
                  : data.latestClosedTrade.result === "LOSS"
                    ? "blocked"
                    : "wait"
              }
            >
              {data.latestClosedTrade.result}
            </Badge>
          </div>
          <p className="text-sm">
            {data.latestClosedTrade.symbol} {data.latestClosedTrade.side} ·{" "}
            {data.latestClosedTrade.status === "CLOSED_PENDING_PNL"
              ? "realized PnL pending data"
              : `$${data.latestClosedTrade.netPnl.toFixed(2)} net`}
          </p>
          {data.latestClosedTrade.closeOrderId ? (
            <p className="text-xs text-[var(--muted)]">
              close orderId: {data.latestClosedTrade.closeOrderId} · closed{" "}
              {new Date(data.latestClosedTrade.closedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      ) : null}

      {data.latestClosePreview ? (
        <div className="panel space-y-3">
          <h3 className="font-semibold">Close preview</h3>
          <p className="text-sm">
            {data.latestClosePreview.symbol} · close {data.latestClosePreview.sideToClose} · qty{" "}
            {data.latestClosePreview.qty}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge tone={data.latestClosePreview.status === "ACTIVE" ? "safe" : "blocked"}>
              {data.latestClosePreview.status}
            </Badge>
            <Badge tone="safe">reduceOnly</Badge>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Expires {new Date(data.latestClosePreview.expiresAt).toLocaleString()}
          </p>
          {data.latestClosePreview.blockReasons.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-[var(--danger)]">
              {data.latestClosePreview.blockReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
          {data.latestCloseReview ? (
            <p className="text-sm text-[var(--muted)]">
              Safety review: {data.latestCloseReview.allowed ? "allowed" : "blocked"} ·{" "}
              {new Date(data.latestCloseReview.reviewedAt).toLocaleString()}
            </p>
          ) : null}
          {data.latestCloseReview?.blockers && data.latestCloseReview.blockers.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-[var(--danger)]">
              {data.latestCloseReview.blockers.map((b) => (
                <li key={b.code}>{b.code}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-[var(--muted)]">
            Run safety review, then execute reduce-only close (MVP 5C).
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-3">
          <h3 className="font-semibold">Latest decision</h3>
          <div className="flex flex-wrap gap-2">
            {data.latestVerdict ? (
              <Badge
                tone={
                  data.latestVerdict === "BLOCKED"
                    ? "blocked"
                    : data.latestVerdict === "TRADE"
                      ? "safe"
                      : "wait"
                }
              >
                {data.latestVerdict}
              </Badge>
            ) : (
              <Badge tone="wait">IDLE</Badge>
            )}
            <Badge tone="safe">Live locked</Badge>
            <Badge tone={safetyTone}>{data.executionSafetyStatus ?? "no_preview"}</Badge>
          </div>
          <p className="text-sm text-[var(--muted)]">{data.nextAction}</p>
          {data.latestVerdictReasons?.some((r) => r.includes("Scenario")) ? (
            <p className="text-xs text-[var(--muted)]">
              {data.latestVerdictReasons.find((r) => r.includes("Scenario") || r.includes("swarm")) ??
                data.latestVerdictReasons[data.latestVerdictReasons.length - 1]}
            </p>
          ) : null}
          {data.latestVerdictReasons?.some((r) => r.includes("No-trade rule")) ? (
            <Badge tone="blocked">No-trade rule active</Badge>
          ) : null}
        </div>

        <div className="panel space-y-3">
          <h3 className="font-semibold">Latest preview</h3>
          {preview ? (
            <>
              <p className="text-sm">
                {preview.symbol} {preview.side} · ${preview.notionalUsd} · qty{" "}
                {preview.estimatedQty}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {preview.status} · expires {new Date(preview.expiresAt).toLocaleString()}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowExecutionReview(true)}
                >
                  Review preview
                </button>
              </div>
              {data.latestOpenTrade ? (
                <div className="rounded border border-[var(--success)]/30 p-2 text-xs">
                  <p className="font-medium text-[var(--success)]">Open testnet trade</p>
                  <p>
                    {data.latestOpenTrade.symbol} {data.latestOpenTrade.side} · qty{" "}
                    {data.latestOpenTrade.qty}
                  </p>
                  <p className="text-[var(--muted)]">
                    orderId {data.latestOpenTrade.orderId} ·{" "}
                    {new Date(data.latestOpenTrade.openedAt).toLocaleString()}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="empty-state">No active preview.</p>
          )}
        </div>
      </div>

      {showExecutionReview && preview ? (
        <ExecutionReviewModal
          preview={preview}
          onClose={() => setShowExecutionReview(false)}
          onReviewed={refresh}
        />
      ) : null}

      {showCloseReview && data.latestOpenTrade ? (
        <CloseReviewModal
          tradeId={data.latestOpenTrade.tradeId}
          symbol={data.latestOpenTrade.symbol}
          side={data.latestOpenTrade.side}
          qty={data.latestOpenTrade.qty}
          onClose={() => setShowCloseReview(false)}
          onReviewed={refresh}
        />
      ) : null}
    </div>
  );
}
