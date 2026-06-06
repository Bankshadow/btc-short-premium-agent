"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import GoalShell from "./GoalShell";
import type { GoalProgressSnapshot } from "@/lib/goal-engine/types";
import type { CoreEngineRegistrySnapshot } from "@/lib/core-engine-registry/types";

interface DashboardResponse {
  ok: boolean;
  goal?: GoalProgressSnapshot;
  engines?: CoreEngineRegistrySnapshot;
  error?: string;
}

const STATUS_COPY: Record<string, string> = {
  IDLE: "Idle",
  ANALYZING: "Analyzing",
  MONITORING: "Monitoring",
  IN_TRADE: "In trade",
  WAITING: "Waiting",
  BLOCKED: "Blocked",
};

export default function AIStatusView() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/goal-dashboard", { cache: "no-store" });
      const json = (await res.json()) as DashboardResponse;
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load AI status");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load AI status");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const goal = data?.goal;
  const ai = goal?.aiActivity;
  const engines = data?.engines;

  return (
    <GoalShell
      title="AI Status"
      subtitle="What the AI is doing now, last cycle results, and which background engines need you."
      activePath="/ai-status"
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-50"
        >
          {busy ? "Loading..." : "Refresh"}
        </button>
      }
    >
      {error && (
        <p className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      {ai && (
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Current mode</p>
          <p className="mt-1 font-mono text-2xl text-zinc-50">
            {STATUS_COPY[ai.status] ?? ai.status}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-xs text-zinc-400">
            <div>
              <dt className="text-zinc-500">Last cycle</dt>
              <dd className="mt-0.5 text-zinc-200">
                {goal?.lastCycleAt
                  ? new Date(goal.lastCycleAt).toLocaleString()
                  : "No cycle has run yet."}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Last verdict</dt>
              <dd className="mt-0.5 text-zinc-200">{goal?.lastVerdict ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Current strategy</dt>
              <dd className="mt-0.5 text-zinc-200">{goal?.currentStrategy ?? "Default"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Risk status</dt>
              <dd className={`mt-0.5 ${goal?.risk.blocker ? "text-rose-300" : "text-emerald-300"}`}>
                {goal?.risk.blocker ?? "Within safe limits"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Last action</dt>
              <dd className="mt-0.5 text-zinc-200">{ai.lastAction}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Next action</dt>
              <dd className="mt-0.5 text-zinc-200">{ai.nextPlannedAction}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Human action required</dt>
              <dd className={`mt-0.5 ${ai.humanActionRequired ? "text-amber-300" : "text-emerald-300"}`}>
                {ai.humanActionRequired ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Reason</dt>
              <dd className="mt-0.5 text-zinc-200">{ai.reason}</dd>
            </div>
          </dl>
        </section>
      )}

      {engines && (
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Background engines
            </h2>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              {showAdvanced ? "Hide advanced reasoning" : "Show advanced reasoning"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-zinc-600">{engines.safetyNotice}</p>
          <ul className="mt-3 space-y-2 text-xs">
            {(showAdvanced ? engines.engines : engines.visibleEngines).map((engine) => (
              <li
                key={engine.engineId}
                className="flex items-center justify-between gap-3 rounded border border-zinc-800/70 px-3 py-2"
              >
                <span className="text-zinc-300">
                  <span className="font-semibold">{engine.label}</span>{" "}
                  <span className="text-zinc-500">[{engine.status}]</span> —{" "}
                  {showAdvanced ? engine.summary : engine.userVisibleSummary}
                </span>
                {(engine.actionHref ?? engine.advancedHref) && (
                  <Link
                    href={engine.actionHref ?? engine.advancedHref ?? "#"}
                    className="shrink-0 text-emerald-300 hover:underline"
                  >
                    Open →
                  </Link>
                )}
              </li>
            ))}
            {!showAdvanced && engines.visibleEngines.length === 0 && (
              <li className="text-zinc-500">All engines healthy. Nothing needs attention.</li>
            )}
          </ul>
        </section>
      )}

      {showAdvanced && (
        <p className="text-[11px] text-zinc-600">
          Raw multi-agent debate:{" "}
          <Link href="/cockpit" className="text-emerald-300 hover:underline">
            Open advanced cockpit
          </Link>
          .
        </p>
      )}
    </GoalShell>
  );
}
