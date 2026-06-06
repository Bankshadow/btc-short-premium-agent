"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell from "@/components/ops/OpsShell";
import { useBackgroundWorker } from "@/hooks/useBackgroundWorker";
import {
  WORKER_JOB_LABELS,
  WORKER_SAFETY_NOTICE,
} from "@/lib/background-worker/config";
import type { WorkerRunResult } from "@/lib/background-worker/types";

function statusTone(status: string): string {
  if (status === "COMPLETED") return "text-emerald-300";
  if (status === "FAILED" || status === "BLOCKED") return "text-rose-300";
  if (status === "SKIPPED") return "text-amber-300";
  return "text-zinc-400";
}

export default function WorkerDashboard() {
  const worker = useBackgroundWorker({ enabled: false });
  const [history, setHistory] = useState<WorkerRunResult[]>([]);
  const [settings, setSettings] = useState(worker.settings);

  const refresh = useCallback(async () => {
    setSettings(worker.updateSettings({}));
    await worker.refreshStatus();
    try {
      const res = await fetch("/api/worker/history");
      const data = (await res.json()) as { ok: boolean; history?: WorkerRunResult[] };
      if (data.ok && data.history) setHistory(data.history);
    } catch {
      /* optional */
    }
  }, [worker]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patch = (p: Parameters<typeof worker.updateSettings>[0]) => {
    const next = worker.updateSettings(p);
    setSettings(next);
  };

  return (
    <OpsShell
      badge="MVP 46 · Background Worker"
      title="Background Worker & Scheduler"
      subtitle="Headless desk cycles — analyze, paper monitor, learning, notifications. Live execution remains manual."
      accent="cyan"
      iconLetters="WK"
      activePath="/worker"
      nav={[
        { href: "/", label: "← Cockpit" },
        { href: "/autopilot", label: "Autopilot" },
        { href: "/notifications", label: "Alerts" },
      ]}
    >
      <p className="rounded-lg border border-cyan-900/40 bg-cyan-950/20 px-4 py-2 text-xs text-cyan-200/90">
        {WORKER_SAFETY_NOTICE}
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-[10px] uppercase text-zinc-500">Status</p>
          <p className={`mt-1 text-lg font-semibold ${statusTone(worker.lastRun?.status ?? "IDLE")}`}>
            {worker.lastRun?.status ?? "IDLE"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-[10px] uppercase text-zinc-500">Last success</p>
          <p className="mt-1 text-xs text-zinc-300">
            {worker.status?.lastSuccessfulRunAt
              ? new Date(worker.status.lastSuccessfulRunAt).toLocaleString()
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-[10px] uppercase text-zinc-500">Next run</p>
          <p className="mt-1 text-xs text-zinc-300">
            {worker.status?.nextRunAt
              ? new Date(worker.status.nextRunAt).toLocaleString()
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-[10px] uppercase text-zinc-500">Backbone</p>
          <p className="mt-1 text-xs text-zinc-300">
            {worker.status?.backboneHealthy ? "Healthy" : "Check required"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={worker.running}
          onClick={() => void worker.runCycle({ force: true })}
          className="rounded-lg bg-cyan-800/70 px-3 py-1.5 text-xs text-zinc-100 hover:bg-cyan-700/70 disabled:opacity-50"
        >
          Run worker now
        </button>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={settings.workerEnabled}
            onChange={(e) => patch({ workerEnabled: e.target.checked })}
          />
          Background worker enabled
        </label>
        <label className="text-xs text-zinc-400">
          Interval (min)
          <input
            type="number"
            min={5}
            max={120}
            className="ml-2 w-16 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-zinc-200"
            value={settings.intervalMinutes}
            onChange={(e) =>
              patch({ intervalMinutes: Number(e.target.value) || 15 })
            }
          />
        </label>
      </div>

      {worker.lastRun && (
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Last run · {worker.lastRun.runId}
          </h2>
          <p className="text-xs text-zinc-500">
            {worker.lastRun.startedAt} → {worker.lastRun.completedAt ?? "—"} ·{" "}
            {worker.lastRun.jobs.length} job(s)
          </p>
          {worker.lastRun.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-rose-300">
              {worker.lastRun.errors.map((e) => (
                <li key={e}>· {e}</li>
              ))}
            </ul>
          )}
          <ul className="mt-3 space-y-2">
            {worker.lastRun.jobs.map((j) => (
              <li
                key={j.idempotencyKey}
                className="rounded border border-zinc-800 px-2 py-1.5 text-xs"
              >
                <span className="text-zinc-300">{WORKER_JOB_LABELS[j.jobType]}</span>{" "}
                <span className={statusTone(j.status)}>{j.status}</span>{" "}
                <span className="text-zinc-600">{j.durationMs}ms</span>
                <p className="text-zinc-500">{j.summary}</p>
                {j.error && <p className="text-rose-400">{j.error}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {worker.failedJobs.length > 0 && (
        <section className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-rose-300">
            Failed jobs
          </h2>
          <ul className="space-y-2">
            {worker.failedJobs.map((f) => (
              <li key={f.failedJobId} className="rounded border border-rose-900/30 px-3 py-2 text-xs">
                <p className="font-medium text-rose-200">
                  {WORKER_JOB_LABELS[f.jobType]} · {f.failedAt.slice(0, 16)}
                </p>
                <p className="text-rose-300/80">{f.error}</p>
                <button
                  type="button"
                  disabled={worker.running}
                  onClick={() => void worker.retryJob(f.failedJobId)}
                  className="mt-2 rounded bg-rose-800/50 px-2 py-1 text-rose-100 hover:bg-rose-700/50 disabled:opacity-50"
                >
                  Retry
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Run history
          </h2>
          <ul className="space-y-1 text-xs text-zinc-500">
            {history.slice(0, 12).map((h) => (
              <li key={h.runId}>
                {h.completedAt ?? h.startedAt} —{" "}
                <span className={statusTone(h.status)}>{h.status}</span> —{" "}
                {h.jobs.filter((j) => j.status === "OK").length}/{h.jobs.length} jobs OK
              </li>
            ))}
          </ul>
        </section>
      )}

      {worker.error && (
        <p className="rounded border border-rose-900/50 px-3 py-2 text-xs text-rose-300">
          {worker.error}
        </p>
      )}

      <Link href="/" className="text-xs text-cyan-400 hover:underline">
        Return to cockpit →
      </Link>
    </OpsShell>
  );
}
