"use client";

import { useMemo, useState } from "react";
import { fetchJson } from "@/lib/api/fetch-json";
import { useApi } from "@/components/use-api";
import { useUiProjectionData } from "@/components/use-projection-bundle";
import { ExecutionReviewModal } from "@/components/ExecutionReviewModal";
import { CloseReviewModal } from "@/components/CloseReviewModal";
import {
  EventFeed,
  LifecycleTimeline,
  MetricCard,
  PageHeader,
  ProgressCard,
  ProjectionWarning,
  RiskBanner,
  SafetyLabelsBar,
  SafetyPanel,
  SectionCard,
  StatusBadge,
  statusFromHealth,
} from "@/components/ui";
import {
  zeroDashboardUiContext,
  type DashboardUiContext,
} from "@/lib/core/ui-context-zero";
import { PROJECTION_FALLBACK_ACTIVE_MESSAGE } from "@/lib/core/projection-defaults";
import { PNL_PENDING_LABEL, staleTradeBannerText } from "@/lib/core/stale-trade-display";
import { deriveLifecycleDisplay } from "@/lib/ui/lifecycle-display";
import { mergePageUiProjection, type UiProjectionData } from "@/lib/core/ui-projection-data";

export function DashboardClient({ initialUi }: { initialUi: UiProjectionData }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const projectionCtx = useUiProjectionData(refreshKey);
  const ui = mergePageUiProjection(initialUi, projectionCtx);
  const ctxFallback = useMemo(() => zeroDashboardUiContext(), []);
  const {
    data: ctx,
    error: ctxError,
    reload: reloadCtx,
  } = useApi<DashboardUiContext>("/api/core/ui/context", refreshKey, {
    fallback: ctxFallback,
  });

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [showExecutionReview, setShowExecutionReview] = useState(false);
  const [showCloseReview, setShowCloseReview] = useState(false);
  const [refreshingPosition, setRefreshingPosition] = useState(false);

  const data = ctx ?? ctxFallback;
  const preview = data.latestPreview;
  const showFallbackWarning = ui.isFallback && !ui.loading;
  const lifecycle = deriveLifecycleDisplay(
    ui.mission as Parameters<typeof deriveLifecycleDisplay>[0],
    data,
    ui.evidence.valid,
  );
  const staleWarnings = ui.trades.staleOpenWarnings;
  const projectionWarnings = [
    ...(showFallbackWarning ? [PROJECTION_FALLBACK_ACTIVE_MESSAGE] : []),
    ...ui.warnings.filter((w) => w !== PROJECTION_FALLBACK_ACTIVE_MESSAGE),
    ...(ctxError ? [`ui/context: ${ctxError}`] : []),
  ];

  function refresh() {
    setRefreshKey((k) => k + 1);
    ui.reload();
    reloadCtx();
  }

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

  async function refreshPosition() {
    setRefreshingPosition(true);
    try {
      await fetchJson("/api/positions/refresh", { method: "POST" });
      refresh();
    } finally {
      setRefreshingPosition(false);
    }
  }

  const pnlIntent =
    ui.mission.netPnl > 0 ? "positive" : ui.mission.netPnl < 0 ? "negative" : "neutral";

  return (
    <div className="ui-dashboard-grid">
      <PageHeader
        title="Mission Overview"
        description={`Testnet mission $${ui.mission.startCapital.toLocaleString()} → $${ui.mission.targetCapital.toLocaleString()}`}
        updatedAt={ui.loadedAt ? new Date(ui.loadedAt).toLocaleTimeString() : undefined}
        actions={
          <>
            <button type="button" className="btn btn-primary" disabled={running} onClick={startAi}>
              {running ? "Running…" : "Start AI"}
            </button>
            <button type="button" className="btn" onClick={refresh}>
              Refresh
            </button>
          </>
        }
      />

      <SafetyLabelsBar />

      <section
        className="rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2 font-mono text-xs text-[var(--muted)]"
        aria-label="Projection source diagnostic"
      >
        Projection source: {ui.source}
        {" · "}
        totalTrades={ui.mission.totalTrades}
        {" · "}
        closedTrades={ui.mission.closedTrades}
        {" · "}
        evidence={ui.evidence.valid}/{ui.evidence.required}
        {" · "}
        health={ui.health.status}
        {" · "}
        verdict={ui.mission.latestVerdict ?? "—"}
        {" · "}
        runId={ui.mission.latestRunId ?? "—"}
      </section>

      <ProjectionWarning
        warnings={projectionWarnings}
        title={showFallbackWarning ? PROJECTION_FALLBACK_ACTIVE_MESSAGE : undefined}
        onRetry={refresh}
      />

      {staleWarnings.length > 0 ? (
        <RiskBanner variant="info" title="Stale trade reconciliation">
          {staleTradeBannerText(staleWarnings.length)}
        </RiskBanner>
      ) : null}

      {runError ? <div className="error-box">{runError}</div> : null}

      {data.readyForMvp5 === false && data.readyForMvp5Message ? (
        <RiskBanner variant="info" title="MVP5 readiness">
          {data.readyForMvp5Message}
        </RiskBanner>
      ) : null}

      {data.noTradeBlockReason ? (
        <RiskBanner variant="blocked" title="No-trade rule active">
          {data.noTradeBlockReason}
        </RiskBanner>
      ) : null}

      <div className="ui-dashboard-metrics">
        <MetricCard label="Current equity" value={`$${ui.mission.currentEquity.toLocaleString()}`} />
        <MetricCard label="Target equity" value={`$${ui.mission.targetEquity.toLocaleString()}`} />
        <MetricCard label="Progress" value={`${ui.mission.progressPct}%`} tag="mission" />
        <MetricCard label="Net PnL" value={`$${ui.mission.netPnl.toFixed(2)}`} intent={pnlIntent} />
        <MetricCard label="Total trades" value={String(ui.mission.totalTrades)} />
        <MetricCard label="Open trades" value={String(ui.mission.openTrades)} />
        <MetricCard label="Closed trades" value={String(ui.mission.closedTrades)} />
      </div>

      <SafetyPanel
        headerAddon={ui.health.status}
        items={[
          {
            title: "Core health",
            value: ui.health.status,
            detail:
              ui.health.blockingIssues?.length
                ? `${ui.health.blockingIssues.length} blocker(s)`
                : `${ui.health.warnings?.length ?? 0} warning group(s)`,
            tone: statusFromHealth(ui.health.status),
          },
          {
            title: "Live locked",
            value: ui.risk.liveLocked ? "true" : "false",
            tone: ui.risk.liveLocked ? "ok" : "blocked",
          },
          {
            title: "Binance",
            value: ui.binanceStatus.status,
            detail: ui.binanceStatus.baseUrl,
            tone: statusFromHealth(ui.binanceStatus.status),
          },
          {
            title: "Risk mode",
            value: (ui.risk as { mode?: string }).mode ?? "DEFENSIVE",
            detail: (ui.risk as { status?: string }).status ?? "SAFE",
            tone: statusFromHealth((ui.risk as { status?: string }).status),
          },
        ]}
      />

      {(ui.health.blockingIssues?.length ?? 0) > 0 ? (
        <RiskBanner variant="blocked" title="Execution blockers">
          <ul className="list-inside list-disc">
            {ui.health.blockingIssues.map((b) => (
              <li key={b.code}>
                {b.code}: {b.message}
              </li>
            ))}
          </ul>
        </RiskBanner>
      ) : null}

      <LifecycleTimeline
        activePhase={lifecycle.activePhase}
        completedPhases={lifecycle.completedPhases}
        fields={lifecycle.fields}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Trade / Position"
          addon={data.reconciliation?.status ?? "OK"}
          tone={statusFromHealth(data.reconciliation?.status)}
        >
          {data.latestOpenTrade ? (
            <div className="space-y-3 text-sm">
              <p className="font-medium">
                {data.latestOpenTrade.symbol} {data.latestOpenTrade.side} · qty {data.latestOpenTrade.qty}
              </p>
              {data.latestPosition ? (
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Entry</dt>
                    <dd>{data.latestPosition.entryPrice ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Mark</dt>
                    <dd>{data.latestPosition.markPrice ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Unrealized PnL</dt>
                    <dd>
                      {data.latestPosition.unrealizedPnl != null
                        ? `$${data.latestPosition.unrealizedPnl.toFixed(4)}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Status</dt>
                    <dd>{data.latestPosition.status}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-[var(--muted)]">Refresh position to sync with exchange.</p>
              )}
              <p className="text-xs text-[var(--muted)]">
                Reconciliation: {data.reconciliation?.status ?? "—"} · open count{" "}
                {ui.trades.effectiveOpenCount}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn" disabled={refreshingPosition} onClick={refreshPosition}>
                  {refreshingPosition ? "Refreshing…" : "Refresh position"}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setShowCloseReview(true)}>
                  Review close
                </button>
              </div>
            </div>
          ) : !data.latestOpenTrade && ui.trades.effectiveOpenCount === 0 && data.latestClosedTrade ? (
            <div className="space-y-2 text-sm">
              <StatusBadge
                label={data.latestClosedTrade.result}
                tone={
                  data.latestClosedTrade.result === "WIN"
                    ? "ok"
                    : data.latestClosedTrade.result === "LOSS"
                      ? "blocked"
                      : "warning"
                }
              />
              <p>
                Latest closed: {data.latestClosedTrade.symbol} ·{" "}
                {data.latestClosedTrade.status === "CLOSED_PENDING_PNL" ||
                data.latestClosedTrade.result === "PENDING_PNL"
                  ? PNL_PENDING_LABEL
                  : `$${data.latestClosedTrade.netPnl.toFixed(2)}`}
              </p>
            </div>
          ) : (
            <p className="empty-state">No open position — projection shows {ui.trades.effectiveOpenCount} active.</p>
          )}
        </SectionCard>

        <ProgressCard
          title="Evidence & Learning"
          current={ui.evidence.valid}
          required={ui.evidence.required}
          statusLabel={ui.evidence.readinessStatus ?? "COLLECTING"}
          tone={ui.evidence.readinessStatus === "COMPLETE" ? "ok" : "warning"}
          message={ui.evidence.message ?? undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="AI Intelligence" addon="ADVISORY">
          <div className="space-y-2 text-sm">
            <p>
              Verdict:{" "}
              <StatusBadge
                label={ui.mission.latestVerdict ?? "IDLE"}
                tone={
                  ui.mission.latestVerdict === "TRADE"
                    ? "ok"
                    : ui.mission.latestVerdict === "BLOCKED"
                      ? "blocked"
                      : "warning"
                }
              />
            </p>
            <p className="text-[var(--muted)]">{data.nextAction}</p>
            {data.swarmReport ? (
              <p>
                MiroFish: {data.swarmReport.likelyScenario} · {data.swarmReport.advisorySignal} ·{" "}
                {data.swarmReport.recommendedAction}
              </p>
            ) : (
              <p className="text-[var(--muted)]">No swarm advisory report.</p>
            )}
            <p className="text-xs text-[var(--muted)]">{data.scenarioNote ?? data.swarmReport?.safetyNote}</p>
          </div>
        </SectionCard>

        <SectionCard title="Latest preview" addon={preview?.status ?? "NONE"}>
          {preview ? (
            <div className="space-y-2 text-sm">
              <p>
                {preview.symbol} {preview.side} · ${preview.notionalUsd} · qty {preview.estimatedQty}
              </p>
              <p className="text-xs text-[var(--muted)]">
                Expires {new Date(preview.expiresAt).toLocaleString()}
              </p>
              <button type="button" className="btn btn-primary" onClick={() => setShowExecutionReview(true)}>
                Review preview
              </button>
            </div>
          ) : (
            <p className="empty-state">No active preview.</p>
          )}
        </SectionCard>
      </div>

      {data.latestClosePreview ? (
        <SectionCard title="Close preview" addon={data.latestClosePreview.status}>
          <p className="text-sm">
            {data.latestClosePreview.symbol} · close {data.latestClosePreview.sideToClose} · qty{" "}
            {data.latestClosePreview.qty}
          </p>
          <p className="text-xs text-[var(--muted)]">
            reduceOnly · expires {new Date(data.latestClosePreview.expiresAt).toLocaleString()}
          </p>
        </SectionCard>
      ) : null}

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
