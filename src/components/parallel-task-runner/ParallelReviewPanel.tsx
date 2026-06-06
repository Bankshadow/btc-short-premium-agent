"use client";

import { useCallback, useEffect, useState } from "react";
import type { ParallelAgentReview, CommitteeModeratorResult } from "@/lib/parallel-task-runner/types";
import { PARALLEL_TASK_RUNNER_SAFETY_NOTICE } from "@/lib/parallel-task-runner/types";

type Snapshot = {
  ok: boolean;
  reviews?: ParallelAgentReview[];
  committee?: CommitteeModeratorResult | null;
  error?: string;
};

const STATUS_COLOR: Record<string, string> = {
  OK: "text-emerald-300",
  WARNING: "text-amber-300",
  CRITICAL: "text-rose-300",
  SKIPPED: "text-zinc-500",
};

export default function ParallelReviewPanel() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/parallel-task-runner/status", { cache: "no-store" });
      const json = (await res.json()) as Snapshot & {
        lastRun?: { reviews: ParallelAgentReview[]; committee: CommitteeModeratorResult };
      };
      setData({
        ok: json.ok,
        reviews: json.lastRun?.reviews ?? json.reviews,
        committee: json.lastRun?.committee ?? json.committee,
        error: json.error,
      });
    } catch {
      setData({ ok: false, error: "Failed to load parallel reviews" });
    } finally {
      setBusy(false);
    }
  }, []);

  const runReview = useCallback(async (approveCursor: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/parallel-task-runner/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approveCursorPrompt: approveCursor }),
      });
      const json = await res.json();
      setData({
        ok: json.ok,
        reviews: json.reviews,
        committee: json.committee,
        error: json.error,
      });
    } catch {
      setData({ ok: false, error: "Parallel review run failed" });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const committee = data?.committee;
  const reviews = data?.reviews ?? [];

  return (
    <div className="space-y-3 text-xs text-zinc-400">
      <p className="text-[10px] text-zinc-600">{PARALLEL_TASK_RUNNER_SAFETY_NOTICE}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runReview(false)}
          className="rounded border border-indigo-800/60 bg-indigo-950/40 px-2 py-1 text-[10px] text-indigo-200 hover:bg-indigo-900/40 disabled:opacity-50"
        >
          Run parallel review
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runReview(true)}
          className="rounded border border-violet-800/60 bg-violet-950/40 px-2 py-1 text-[10px] text-violet-200 hover:bg-violet-900/40 disabled:opacity-50"
        >
          Run + approve Cursor prompt
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-900 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {committee && (
        <div className="rounded-lg border border-indigo-900/40 bg-indigo-950/20 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-indigo-400/80">
            Committee · {committee.recommendation}
          </p>
          <p className="mt-1 text-sm text-zinc-200">{committee.summary}</p>
          {committee.topReasons.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px]">
              {committee.topReasons.map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          )}
          {committee.cursorPrompt && (
            <pre className="mt-2 max-h-40 overflow-auto rounded border border-zinc-800 bg-zinc-950/60 p-2 font-mono text-[10px] text-zinc-500">
              {committee.cursorPrompt}
            </pre>
          )}
        </div>
      )}

      {reviews.length > 0 && (
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li
              key={r.role}
              className="rounded border border-zinc-800/70 bg-zinc-950/40 px-2 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-300">{r.agentName}</span>
                <span className={`text-[10px] ${STATUS_COLOR[r.status] ?? "text-zinc-500"}`}>
                  {r.status} · {r.durationMs}ms
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">{r.headline}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
