"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import type {
  TradeLifecycleTimelineView,
  TradeTimelineActor,
  TradeTimelineEvent,
  TradeTimelineRiskStatus,
  TradeTimelineStage,
} from "@/lib/trade-lifecycle";

const STAGE_LABELS: Record<TradeTimelineStage, string> = {
  AI_SIGNAL_CREATED: "AI signal created",
  DECISION_LOGGED: "Decision logged",
  ORDER_PREVIEW_CREATED: "Order preview created",
  RISK_CHECK_PASSED: "Risk check passed",
  HUMAN_CONFIRMED: "Human confirmed",
  ORDER_EXECUTED: "Order executed",
  POSITION_OPENED: "Position opened",
  MONITORING_STARTED: "Monitoring started",
  CLOSE_RECOMMENDED: "Close recommended",
  POSITION_CLOSED: "Position closed",
  PNL_REALIZED: "PnL realized",
  REFLECTION_GENERATED: "Reflection generated",
  LEARNING_COMPLETED: "Learning completed",
};

function actorBadge(actor: TradeTimelineActor): string {
  if (actor === "AI") return "text-indigo-300 bg-indigo-950/40 border-indigo-800/50";
  if (actor === "USER") return "text-amber-300 bg-amber-950/40 border-amber-800/50";
  if (actor === "EXCHANGE") return "text-cyan-300 bg-cyan-950/40 border-cyan-800/50";
  return "text-zinc-300 bg-zinc-900/60 border-zinc-700/70";
}

function riskBadge(risk: TradeTimelineRiskStatus): string {
  if (risk === "PASSED") return "text-emerald-300";
  if (risk === "BLOCKED") return "text-rose-300";
  if (risk === "CAUTION") return "text-amber-300";
  return "text-zinc-500";
}

function compact(v: string | null): string {
  if (!v) return "—";
  return v.length > 16 ? `${v.slice(0, 16)}...` : v;
}

function eventPrimaryId(event: TradeTimelineEvent): string {
  return (
    event.linkedIds.closedTradeId ??
    event.linkedIds.tradeId ??
    event.linkedIds.orderId ??
    event.linkedIds.decisionLogId ??
    event.eventId
  );
}

export default function TradeLifecycleTimelinePage({
  tradeId,
}: {
  tradeId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TradeLifecycleTimelineView | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trades/${encodeURIComponent(tradeId)}/timeline`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Timeline fetch failed");
      }
      setTimeline(data.timeline as TradeLifecycleTimelineView);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Timeline fetch failed");
      setTimeline(null);
    } finally {
      setBusy(false);
    }
  }, [tradeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const latest = timeline?.events.at(-1) ?? null;
  const eventCount = timeline?.events.length ?? 0;
  const blockedCount = timeline?.events.filter((e) => e.riskStatus === "BLOCKED").length ?? 0;
  const hasErrors = timeline?.events.some((e) => e.error) ?? false;

  const links = useMemo(() => {
    const ids = timeline?.linkedIds;
    if (!ids) {
      return {
        aiDecision: "/",
        orderPreview: "/binance-testnet",
        riskChecks: "/validation",
        exchangeResponse: "/testnet-monitor",
      };
    }
    return {
      aiDecision: ids.decisionLogId ? `/?highlight=${encodeURIComponent(ids.decisionLogId)}` : "/",
      orderPreview: ids.previewId
        ? `/binance-testnet?preview=${encodeURIComponent(ids.previewId)}`
        : "/binance-testnet",
      riskChecks: "/validation",
      exchangeResponse: ids.closedTradeId
        ? `/testnet-monitor?tradeId=${encodeURIComponent(ids.closedTradeId)}`
        : "/testnet-monitor",
    };
  }, [timeline?.linkedIds]);

  const learningActionDisabled = !timeline?.linkedIds.learningRecordId;

  const updateLearning = useCallback(
    async (route: string) => {
      const learningRecordId = timeline?.linkedIds.learningRecordId;
      if (!learningRecordId) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(route, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ learningRecordId }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "Learning update failed");
        }
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Learning update failed");
      } finally {
        setBusy(false);
      }
    },
    [timeline?.linkedIds.learningRecordId, refresh],
  );

  return (
    <OpsShell
      badge="MVP 49 · Trade lifecycle timeline"
      title={`Trade Timeline · ${tradeId}`}
      subtitle="Full AI/TESTNET/PAPER lifecycle from signal to learning completion with linked IDs, payload, risk status, and errors."
      accent="indigo"
      iconLetters="TL"
      activePath="/trades"
      nav={[
        { href: "/testnet-monitor", label: "Testnet monitor" },
        { href: "/ledger", label: "Ledger" },
        { href: "/portfolio", label: "Portfolio" },
        { href: "/learning", label: "Learning" },
      ]}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded border border-indigo-700/50 bg-indigo-950/40 px-3 py-1.5 text-xs text-indigo-200 hover:bg-indigo-900/40 disabled:opacity-50"
        >
          {busy ? "Refreshing..." : "Refresh timeline"}
        </button>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi label="Events" value={String(eventCount)} hint="End-to-end chain" />
        <OpsKpi
          label="Current stage"
          value={latest ? STAGE_LABELS[latest.stage] : "—"}
          hint={latest?.timestamp ? new Date(latest.timestamp).toLocaleString() : "No data"}
        />
        <OpsKpi
          label="Risk blocks"
          value={String(blockedCount)}
          hint={blockedCount > 0 ? "Investigate failures" : "No hard block"}
        />
        <OpsKpi
          label="Errors"
          value={hasErrors ? "Yes" : "No"}
          hint={hasErrors ? "At least one event contains error payload" : "Clean run"}
        />
      </div>

      {error && (
        <p className="mb-3 rounded border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <section className="mb-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Timeline actions
        </h2>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href={links.aiDecision}
            className="rounded border border-indigo-800/50 px-2 py-1 text-indigo-300 hover:bg-indigo-950/40"
          >
            View AI decision
          </Link>
          <Link
            href={links.orderPreview}
            className="rounded border border-cyan-800/50 px-2 py-1 text-cyan-300 hover:bg-cyan-950/40"
          >
            View order preview
          </Link>
          <Link
            href={links.riskChecks}
            className="rounded border border-amber-800/50 px-2 py-1 text-amber-300 hover:bg-amber-950/40"
          >
            View risk checks
          </Link>
          <Link
            href={links.exchangeResponse}
            className="rounded border border-emerald-800/50 px-2 py-1 text-emerald-300 hover:bg-emerald-950/40"
          >
            View exchange response
          </Link>
          <Link
            href={`/risk-replay?tradeId=${encodeURIComponent(timeline?.tradeId ?? tradeId)}`}
            className="rounded border border-rose-800/50 px-2 py-1 text-rose-300 hover:bg-rose-950/40"
          >
            Run What-If
          </Link>
          <button
            type="button"
            disabled={busy || learningActionDisabled}
            onClick={() =>
              void updateLearning("/api/testnet-monitor/learning/generate-reflection")
            }
            className="rounded border border-violet-800/50 px-2 py-1 text-violet-300 hover:bg-violet-950/40 disabled:opacity-50"
          >
            Generate reflection
          </button>
          <button
            type="button"
            disabled={busy || learningActionDisabled}
            onClick={() =>
              void updateLearning("/api/testnet-monitor/learning/mark-learned")
            }
            className="rounded border border-emerald-800/50 px-2 py-1 text-emerald-300 hover:bg-emerald-950/40 disabled:opacity-50"
          >
            Mark as learned
          </button>
        </div>
        {learningActionDisabled && (
          <p className="mt-2 text-[10px] text-zinc-600">
            Learning actions enable when a linked TESTNET learning record exists.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Lifecycle timeline
        </h2>
        {!timeline ? (
          <p className="text-xs text-zinc-500">No timeline data found for this trade ID.</p>
        ) : (
          <ol className="relative border-l border-zinc-800 pl-4">
            {timeline.events.map((event) => (
              <li key={event.eventId} className="mb-4 ml-1">
                <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-indigo-600" />
                <div className="rounded border border-zinc-800/80 bg-zinc-900/30 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-zinc-500">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${actorBadge(event.actor)}`}
                    >
                      {event.actor}
                    </span>
                    <span className="rounded border border-zinc-700/60 px-1.5 py-0.5 text-[10px] text-zinc-300">
                      {STAGE_LABELS[event.stage]}
                    </span>
                    <span className={`text-[10px] ${riskBadge(event.riskStatus)}`}>
                      risk: {event.riskStatus}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-200">{event.summary}</p>
                  {event.error && (
                    <p className="mt-1 text-[11px] text-rose-300">error: {event.error}</p>
                  )}
                  <p className="mt-2 font-mono text-[10px] text-zinc-500">
                    trade {compact(event.linkedIds.tradeId)} · decision{" "}
                    {compact(event.linkedIds.decisionLogId)} · preview{" "}
                    {compact(event.linkedIds.previewId)} · order{" "}
                    {compact(event.linkedIds.orderId)} · position{" "}
                    {compact(event.linkedIds.positionId)} · learning{" "}
                    {compact(event.linkedIds.learningRecordId)}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-zinc-400 hover:text-zinc-300">
                      payload / linked IDs
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded bg-zinc-950 p-2 text-[10px] text-zinc-400">
                      {JSON.stringify(
                        {
                          id: eventPrimaryId(event),
                          linkedIds: event.linkedIds,
                          payload: event.payload,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </OpsShell>
  );
}
