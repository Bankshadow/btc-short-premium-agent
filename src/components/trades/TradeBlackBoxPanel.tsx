"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  BlackBoxSection,
  TradeBlackBoxRecord,
  TradeBlackBoxTimelineEntry,
} from "@/lib/trade-black-box/types";

const SECTION_LABELS: Record<BlackBoxSection, string> = {
  MARKET_SNAPSHOT: "Market snapshot",
  AI_DECISION: "AI decision",
  AGENT_VOTES: "Agent votes",
  RISK_CHECKS: "Risk checks",
  PREVIEW: "Order preview",
  ORDER_REQUEST: "Order request",
  EXCHANGE_RESPONSE: "Exchange response",
  POSITION_UPDATES: "Position updates",
  CLOSE_EVENT: "Close event",
  PNL: "PnL",
  REFLECTION: "Reflection",
};

function severityClass(severity: string): string {
  if (severity === "HIGH") return "text-rose-300 border-rose-800/50 bg-rose-950/30";
  if (severity === "MEDIUM") return "text-amber-300 border-amber-800/50 bg-amber-950/30";
  if (severity === "LOW") return "text-zinc-300 border-zinc-700/60 bg-zinc-900/40";
  return "text-emerald-300 border-emerald-800/50 bg-emerald-950/30";
}

function outcomeClass(status: string): string {
  if (status === "CLOSED") return "text-emerald-300";
  if (status === "OPEN") return "text-cyan-300";
  if (status === "BLOCKED" || status === "FAILED") return "text-rose-300";
  return "text-zinc-400";
}

function TimelineRow({ entry }: { entry: TradeBlackBoxTimelineEntry }) {
  return (
    <li className="mb-3 ml-1">
      <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-violet-600" />
      <div className="rounded border border-zinc-800/80 bg-zinc-900/30 p-3">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-zinc-500">
            {new Date(entry.timestamp).toLocaleString()}
          </span>
          <span className="rounded border border-violet-800/50 px-1.5 py-0.5 text-[10px] text-violet-300">
            {SECTION_LABELS[entry.section]}
          </span>
          <span className="rounded border border-zinc-700/60 px-1.5 py-0.5 text-[10px] text-zinc-300">
            {entry.actor}
          </span>
          {entry.hasError && (
            <span className="text-[10px] text-rose-300">error</span>
          )}
        </div>
        <p className="text-xs text-zinc-200">{entry.summary}</p>
        {entry.error && (
          <p className="mt-1 text-[11px] text-rose-300">{entry.error}</p>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-zinc-400 hover:text-zinc-300">
            section data
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-zinc-950 p-2 text-[10px] text-zinc-400">
            {JSON.stringify(entry.data, null, 2)}
          </pre>
        </details>
      </div>
    </li>
  );
}

function gradeClass(grade: string | null | undefined): string {
  if (grade === "A") return "text-emerald-300";
  if (grade === "B") return "text-teal-300";
  if (grade === "C") return "text-amber-300";
  if (grade === "D") return "text-orange-300";
  if (grade === "F") return "text-rose-300";
  return "text-zinc-200";
}

export default function TradeBlackBoxPanel({ tradeId }: { tradeId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<TradeBlackBoxRecord | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/trade-black-box/${encodeURIComponent(tradeId)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Black box fetch failed");
      }
      setRecord(data.record as TradeBlackBoxRecord);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Black box fetch failed");
      setRecord(null);
    } finally {
      setBusy(false);
    }
  }, [tradeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const downloadPack = useCallback(() => {
    window.location.href = `/api/trade-black-box/${encodeURIComponent(tradeId)}/debug-pack`;
  }, [tradeId]);

  return (
    <section className="mb-4 rounded-xl border border-violet-900/40 bg-zinc-950/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-300">
            AI Trade Black Box
          </h2>
          <p className="text-[11px] text-zinc-500">
            Full debug context — no API keys or secrets stored.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="rounded border border-violet-700/50 bg-violet-950/40 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-900/40 disabled:opacity-50"
          >
            {busy ? "Loading..." : "Refresh black box"}
          </button>
          <button
            type="button"
            disabled={busy || !record}
            onClick={downloadPack}
            className="rounded border border-cyan-700/50 bg-cyan-950/40 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-900/40 disabled:opacity-50"
          >
            Download debug pack
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      {!record ? (
        <p className="text-xs text-zinc-500">No black box record for this trade yet.</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-zinc-800/80 bg-zinc-900/30 p-3">
              <p className="text-[10px] uppercase text-zinc-500">Outcome</p>
              <p className={`text-sm font-medium ${outcomeClass(record.outcomeStatus)}`}>
                {record.outcomeStatus}
              </p>
            </div>
            <div className="rounded border border-zinc-800/80 bg-zinc-900/30 p-3">
              <p className="text-[10px] uppercase text-zinc-500">Failure cause</p>
              <p className="text-sm font-medium text-zinc-200">
                {record.failureCause.headline}
              </p>
            </div>
            <div className="rounded border border-zinc-800/80 bg-zinc-900/30 p-3">
              <p className="text-[10px] uppercase text-zinc-500">Category</p>
              <p className="text-sm font-medium text-zinc-200">
                {record.failureCause.category}
              </p>
            </div>
            <div className="rounded border border-zinc-800/80 bg-zinc-900/30 p-3">
              <p className="text-[10px] uppercase text-zinc-500">Quality grade</p>
              <p className={`text-sm font-medium ${gradeClass(record.tradeQualityGrade)}`}>
                {record.tradeQualityGrade ?? "—"}
              </p>
            </div>
          </div>

          <div
            className={`mb-4 rounded border px-3 py-3 ${severityClass(record.failureCause.severity)}`}
          >
            <p className="text-xs font-medium">{record.failureCause.headline}</p>
            <p className="mt-1 text-[11px] opacity-90">{record.failureCause.detail}</p>
            {record.failureCause.evidence.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-[11px] opacity-90">
                {record.failureCause.evidence.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Debug timeline
          </h3>
          <ol className="relative border-l border-zinc-800 pl-4">
            {record.timeline.map((entry) => (
              <TimelineRow key={entry.entryId} entry={entry} />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
