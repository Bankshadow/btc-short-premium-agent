"use client";

import { Badge, LoadingOrError, useApi } from "@/components/use-api";
import { BinanceTestnetDiagnosticsPanel } from "@/components/BinanceTestnetDiagnosticsPanel";
import type { AnalysisVerdict } from "@/lib/analysis/analysis-types";
import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import type { ExecutionSafetyResult } from "@/lib/execution/execution-safety-types";
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
  const latest = useApi<LatestAnalysis>("/api/analysis/latest");
  const review = useApi<ReviewResponse>("/api/execution/review/latest");
  const binance = useApi<BinanceStatusDiagnostics>("/api/binance/status");
  const events = useApi<EventsResponse>("/api/journal/events?limit=30");

  const loading = latest.loading || events.loading || review.loading || binance.loading;
  const error = latest.error ?? events.error ?? review.error ?? binance.error;

  const pending = LoadingOrError({
    loading,
    error,
    onRetry: () => {
      void latest.reload();
      void events.reload();
      void review.reload();
      void binance.reload();
    },
  });  if (pending) return pending;

  const d = latest.data;
  const r = review.data?.review;
  const safetyEvents =
    events.data?.events.filter((e) => SAFETY_EVENTS.has(e.type)) ?? [];

  const latestTradeEvent = events.data?.events.find(
    (e) => e.type === "ORDER_EXECUTED" || e.type === "POSITION_OPENED",
  );

  const latestMonitored = events.data?.events.find((e) => e.type === "POSITION_MONITORED");
  const latestCloseEvent = events.data?.events.find(
    (e) =>
      e.type === "CLOSE_ORDER_EXECUTED" ||
      e.type === "CLOSE_PREVIEW_CREATED" ||
      e.type === "CLOSE_PREVIEW_BLOCKED" ||
      e.type === "CLOSE_REVIEWED" ||
      e.type === "CLOSE_BLOCKED" ||
      e.type === "POSITION_CLOSED",
  );
  const reconciliationWarning = events.data?.events.find(
    (e) => e.type === "POSITION_RECONCILIATION_WARNING",
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">AI Status</h2>
        <button
          type="button"
          className="btn"
          onClick={() => {
            void latest.reload();
            void events.reload();
            void review.reload();
            void binance.reload();
          }}        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-2">
          <h3 className="font-semibold">Latest analysis</h3>
          <p className="text-sm">runId: {d?.runId ?? "—"}</p>
          <p className="text-sm">decisionLogId: {d?.decisionLogId ?? "—"}</p>
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

      {binance.data ? (
        <BinanceTestnetDiagnosticsPanel data={binance.data} title="Binance testnet status" />
      ) : null}

      {reconciliationWarning ? (
        <div className="panel space-y-2 border border-[var(--danger)]/30">
          <h3 className="font-semibold text-[var(--danger)]">Reconciliation warning</h3>
          <p className="text-xs text-[var(--muted)]">
            {new Date(reconciliationWarning.timestamp).toLocaleString()}
          </p>
        </div>
      ) : null}

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

      <div className="panel">        <h3 className="mb-3 font-semibold">Recent safety events</h3>
        {safetyEvents.length === 0 ? (
          <p className="empty-state">No safety events yet.</p>
        ) : (
          <div className="space-y-2">
            {safetyEvents.map((e) => (
              <div key={e.eventId} className="rounded border border-[var(--border)] p-2 text-xs">
                <span className="font-mono text-[var(--accent)]">{e.type}</span>
                <span className="ml-2 text-[var(--muted)]">
                  {new Date(e.timestamp).toLocaleString()}
                </span>
                {e.tradeId ? (
                  <p className="mt-1 text-[var(--muted)]">trade: {e.tradeId}</p>
                ) : null}
                {e.previewId ? (
                  <p className="mt-1 text-[var(--muted)]">preview: {e.previewId}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
