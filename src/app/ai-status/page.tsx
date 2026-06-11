"use client";

import { useMemo } from "react";
import { Badge, useApi } from "@/components/use-api";
import {
  EventFeed,
  MetricCard,
  PageHeader,
  ProjectionWarning,
  SafetyLabelsBar,
  SectionCard,
} from "@/components/ui";
import { useProjectionBundle } from "@/components/use-projection-bundle";
import { getDefaultBinanceStatus } from "@/lib/core/projection-defaults";
import {
  zeroAnalysisLatest,
  zeroBinanceStatusApiResponse,
  zeroJournalEventsResponse,
} from "@/lib/core/zero-state";
import { BinanceTestnetDiagnosticsPanel } from "@/components/BinanceTestnetDiagnosticsPanel";
import type { AnalysisVerdict } from "@/lib/analysis/analysis-types";
import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import type { ExecutionSafetyResult } from "@/lib/execution/execution-safety-types";
import type { TraceReport } from "@/lib/core/trace/trace-types";
interface LatestAnalysis {
  runId: string | null;
  decisionLogId: string | null;
  previewId: string | null;
  scenarioContext: { reportId: string; advisorySignal: string } | null;
  swarmAgreement: string | null;
  scenarioNote: string | null;
  regime: string | null;
  noTradeBlockReason: string | null;
  verdict: {
    verdict: AnalysisVerdict;
    confidence: number;
    reasons: string[];
  } | null;
}

interface ReviewResponse {
  review: ExecutionSafetyResult | null;
}

interface EventsResponse {
  events: Array<{
    eventId: string;
    type: string;
    timestamp: string;
    runId?: string;
    decisionLogId?: string;
    previewId?: string;
    tradeId?: string;
  }>;
  total: number;
}

const SAFETY_EVENTS = new Set([
  "EXECUTION_REVIEWED",
  "EXECUTE_BLOCKED",
  "DOUBLE_CONFIRM_REQUIRED",
  "PREVIEW_EXPIRED",
  "DUPLICATE_ORDER_BLOCKED",
  "KILL_SWITCH_BLOCKED",
  "PREVIEW_CREATED",
  "ORDER_EXECUTED",
  "POSITION_OPENED",
  "PNL_CALCULATION_STARTED",
  "PNL_REALIZED",
  "TRADE_RESULT_CLASSIFIED",
  "LEARNING_STARTED",
  "LEARNING_RECORD_CREATED",
  "LEARNING_CREATED",
  "TRADE_REFLECTION_COMPLETED",
  "EVIDENCE_TRADE_VALIDATED",
  "EVIDENCE_TRADE_REJECTED",
  "EVIDENCE_PROGRESS_UPDATED",
  "ENGINE_HEALTH_CHECKED",
  "STATE_HEALTH_BLOCKED",
  "STRATEGY_HEALTH_UPDATED",
  "MIROFISH_SWARM_STARTED",
  "MIROFISH_AGENT_VOTED",
  "MIROFISH_SCENARIO_REPORT_CREATED",
  "SCENARIO_CONTEXT_INJECTED",
  "ANALYSIS_WITH_SCENARIO_COMPLETED",
  "REGIME_CLASSIFIED",
  "REGIME_MEMORY_RETRIEVED",
  "RULE_ENGINE_EVALUATED",
  "NO_TRADE_RULE_TRIGGERED",
  "TRADE_BLOCKED_BY_RULE",
  "AGENT_PROPOSAL_CREATED",
  "AGENT_CRITIQUE_CREATED",
  "AGENT_CONSENSUS_CREATED",
  "AGENT_SCORE_UPDATED",
  "IMPROVEMENT_PROPOSAL_CREATED",
  "STRATEGY_VERSION_CREATED",
  "POSITION_RECONCILIATION_WARNING",
  "CLOSE_PREVIEW_CREATED",
  "CLOSE_PREVIEW_BLOCKED",
  "CLOSE_REVIEWED",
  "CLOSE_BLOCKED",
  "CLOSE_ORDER_EXECUTED",
  "POSITION_CLOSED",
]);

export default function AiStatusPage() {
  const { mission, health, risk, binanceStatus: bundleBinance, warnings: bundleWarnings, reload: reloadBundle } =
    useProjectionBundle();
  const analysisFallback = useMemo(() => zeroAnalysisLatest(), []);
  const reviewFallback = useMemo(() => ({ review: null }), []);
  const binanceFallback = useMemo(() => zeroBinanceStatusApiResponse(), []);
  const eventsFallback = useMemo(() => zeroJournalEventsResponse(), []);
  const latest = useApi<LatestAnalysis>("/api/analysis/latest", 0, {
    fallback: analysisFallback,
  });
  const review = useApi<ReviewResponse>("/api/execution/review/latest", 0, {
    fallback: reviewFallback,
  });
  const binance = useApi<BinanceStatusDiagnostics>("/api/binance/status", 0, {
    fallback: binanceFallback,
  });
  const events = useApi<EventsResponse>("/api/journal/events?limit=30", 0, {
    fallback: eventsFallback,
  });
  const traceTradeId =
    events.data?.events.find(
      (e) => e.type === "ORDER_EXECUTED" || e.type === "POSITION_OPENED",
    )?.tradeId ?? null;
  const trace = useApi<TraceReport>(
    traceTradeId ? `/api/core/trace/${encodeURIComponent(traceTradeId)}` : "",
    0,
    { enabled: Boolean(traceTradeId) },
  );

  const refreshAll = () => {
    reloadBundle();
    void latest.reload();
    void events.reload();
    void review.reload();
    void binance.reload();
    void trace.reload();
  };

  const projectionWarnings = [
    ...bundleWarnings,
    ...(latest.error ? [`analysis/latest: ${latest.error}`] : []),
    ...(events.error ? [`journal/events: ${events.error}`] : []),
    ...(review.error ? [`execution/review: ${review.error}`] : []),
    ...(binance.error ? [`binance/status: ${binance.error}`] : []),
    ...(trace.error ? [`core/trace: ${trace.error}`] : []),
  ];

  const d = latest.data ?? analysisFallback;
  const r = review.data?.review ?? null;
  const safetyEvents =
    (events.data ?? eventsFallback).events.filter((e) => SAFETY_EVENTS.has(e.type));

  const eventList = (events.data ?? eventsFallback).events;

  const latestTradeEvent = eventList.find(
    (e) => e.type === "ORDER_EXECUTED" || e.type === "POSITION_OPENED",
  );

  const latestMonitored = eventList.find((e) => e.type === "POSITION_MONITORED");
  const latestCloseEvent = eventList.find(
    (e) =>
      e.type === "CLOSE_ORDER_EXECUTED" ||
      e.type === "CLOSE_PREVIEW_CREATED" ||
      e.type === "CLOSE_PREVIEW_BLOCKED" ||
      e.type === "CLOSE_REVIEWED" ||
      e.type === "CLOSE_BLOCKED" ||
      e.type === "POSITION_CLOSED",
  );
  const reconciliationWarning = eventList.find(
    (e) => e.type === "POSITION_RECONCILIATION_WARNING",
  );

  const binanceData =
    bundleBinance && !bundleBinance.zeroState ? bundleBinance : binance.data ?? binanceFallback;

  return (
    <div className="ui-dashboard-grid">
      <PageHeader
        title="AI Status"
        description="Latest run, event feed, lifecycle trace, advisory intelligence"
        actions={
          <button type="button" className="btn" onClick={refreshAll}>
            Refresh
          </button>
        }
      />
      <SafetyLabelsBar />
      <ProjectionWarning warnings={projectionWarnings} onRetry={refreshAll} />

      <div className="ui-dashboard-metrics sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Core health" value={health?.status ?? "OK"} />
        <MetricCard label="Mission run" value={mission.latestRunId ?? "—"} />
        <MetricCard label="Decision log" value={mission.latestDecisionLogId ?? "—"} />
        <MetricCard label="Live locked" value={risk.liveLocked ? "true" : "false"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-2">
          <h3 className="font-semibold">Latest analysis</h3>
          <p className="text-sm">runId: {mission.latestRunId ?? d?.runId ?? "—"}</p>
          <p className="text-sm">decisionLogId: {mission.latestDecisionLogId ?? d?.decisionLogId ?? "—"}</p>
          <p className="text-sm">previewId: {d?.previewId ?? "—"}</p>
          {d?.scenarioContext ? (
            <p className="text-sm text-[var(--muted)]">
              Scenario: {d.scenarioContext.reportId} · {d.scenarioContext.advisorySignal}
            </p>
          ) : null}
          {d?.scenarioNote ? (
            <p className="text-xs text-[var(--muted)]">{d.scenarioNote}</p>
          ) : null}
          {d?.regime ? <p className="text-sm">Regime: {d.regime}</p> : null}
          <p className="text-sm">latest tradeId: {latestTradeEvent?.tradeId ?? "—"}</p>
        </div>

        <div className="panel space-y-2">
          <h3 className="font-semibold">Latest execution review</h3>
          {!r ? (
            <p className="empty-state">No execution review yet.</p>
          ) : (
            <>
              <Badge tone={r.allowed ? "safe" : "blocked"}>
                {r.allowed ? "GATE PASSED" : "BLOCKED"}
              </Badge>
              <p className="text-sm text-[var(--muted)]">{r.message}</p>
              {r.blockers.length > 0 ? (
                <ul className="list-inside list-disc text-xs text-[var(--danger)]">
                  {r.blockers.map((b) => (
                    <li key={b.code}>{b.code}</li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      </div>

      <BinanceTestnetDiagnosticsPanel data={binanceData} title="Binance testnet status" />

      {reconciliationWarning ? (
        <div className="panel space-y-2 border border-[var(--danger)]/30">
          <h3 className="font-semibold text-[var(--danger)]">Reconciliation warning</h3>
          <p className="text-xs text-[var(--muted)]">
            {new Date(reconciliationWarning.timestamp).toLocaleString()}
          </p>
        </div>
      ) : null}

      <div className="panel space-y-3">
        <h3 className="font-semibold">Lifecycle trace</h3>
        {!traceTradeId ? (
          <p className="empty-state">No tradeId yet — trace appears after first execution.</p>
        ) : trace.error ? (
          <p className="text-sm text-[var(--danger)]">{trace.error}</p>
        ) : trace.data ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge tone="safe">{trace.data.lifecycleState ?? "UNKNOWN"}</Badge>
              <Badge tone="wait">{trace.data.steps.length} steps</Badge>
            </div>
            {trace.data.invalidTransitions.length > 0 ? (
              <ul className="list-inside list-disc text-xs text-[var(--danger)]">
                {trace.data.invalidTransitions.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            ) : null}
            <div className="space-y-1 text-xs">
              {trace.data.steps.slice(-8).map((step) => (
                <div key={step.eventId} className="rounded border border-[var(--border)] p-2">
                  <span className="font-mono text-[var(--accent)]">{step.type}</span>
                  <span className="ml-2 text-[var(--muted)]">{step.phase}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--muted)]">{trace.data.recommendation}</p>
          </>
        ) : (
          <p className="empty-state">No trace data.</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-2">
          <h3 className="font-semibold">Latest position monitor</h3>
          {!latestMonitored ? (
            <p className="empty-state">No POSITION_MONITORED event yet.</p>
          ) : (
            <>
              <p className="text-sm font-mono text-[var(--accent)]">{latestMonitored.type}</p>
              <p className="text-xs text-[var(--muted)]">
                {new Date(latestMonitored.timestamp).toLocaleString()}
              </p>
              {latestMonitored.tradeId ? (
                <p className="text-xs">trade: {latestMonitored.tradeId}</p>
              ) : null}
            </>
          )}
        </div>

        <div className="panel space-y-2">
          <h3 className="font-semibold">Latest close event</h3>
          {!latestCloseEvent ? (
            <p className="empty-state">No close events yet.</p>
          ) : (
            <>
              <p className="text-sm font-mono text-[var(--accent)]">{latestCloseEvent.type}</p>
              <p className="text-xs text-[var(--muted)]">
                {new Date(latestCloseEvent.timestamp).toLocaleString()}
              </p>
              {latestCloseEvent.tradeId ? (
                <p className="text-xs">trade: {latestCloseEvent.tradeId}</p>
              ) : null}
            </>
          )}
        </div>
      </div>

      <EventFeed
        title="Recent safety events"
        events={safetyEvents.map((e) => ({
          id: e.eventId,
          type: e.type,
          timestamp: e.timestamp,
          meta: [e.tradeId ? `trade: ${e.tradeId}` : null, e.previewId ? `preview: ${e.previewId}` : null]
            .filter(Boolean)
            .join(" · "),
        }))}
        emptyMessage="No safety events yet."
      />
    </div>
  );
}
