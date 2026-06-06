"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { useWorkspaceFetchHeaders } from "@/components/platform/PlatformWorkspaceHeaders";
import {
  AUTOMATION_JOB_LABELS,
  AUTOMATION_SAFETY_NOTICE,
} from "@/lib/automation-control-plane/config";
import type {
  AutomationFailedJob,
  AutomationJob,
  AutomationJobType,
  AutomationRun,
  AutomationSettings,
} from "@/lib/automation-control-plane/types";
import type { OperatorAction } from "@/lib/operator-action-queue/types";

function statusTone(status: string): string {
  if (status === "SUCCESS" || status === "COMPLETED") return "text-emerald-300";
  if (status === "FAILED" || status === "BLOCKED") return "text-rose-300";
  if (status === "SKIPPED") return "text-amber-300";
  if (status === "RUNNING") return "text-cyan-300";
  return "text-zinc-400";
}

const JOB_TYPES = Object.keys(AUTOMATION_JOB_LABELS) as AutomationJobType[];

export default function AutomationControlDashboard() {
  const workspaceHeaders = useWorkspaceFetchHeaders();
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [lastRun, setLastRun] = useState<AutomationRun | null>(null);
  const [history, setHistory] = useState<AutomationRun[]>([]);
  const [failedJobs, setFailedJobs] = useState<AutomationFailedJob[]>([]);
  const [pendingActions, setPendingActions] = useState<OperatorAction[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [statusRes, jobsRes] = await Promise.all([
        fetch("/api/automation/status", { headers: workspaceHeaders }),
        fetch("/api/automation/jobs?limit=30", { headers: workspaceHeaders }),
      ]);
      const statusData = (await statusRes.json()) as {
        ok: boolean;
        snapshot?: {
          state: { settings: AutomationSettings; lastRun: AutomationRun | null };
          pendingOperatorActions: OperatorAction[];
        };
        error?: string;
      };
      const jobsData = (await jobsRes.json()) as {
        ok: boolean;
        history?: AutomationRun[];
        failedJobs?: AutomationFailedJob[];
      };
      if (!statusData.ok) throw new Error(statusData.error ?? "Status failed");
      if (statusData.snapshot) {
        setSettings(statusData.snapshot.state.settings);
        setLastRun(statusData.snapshot.state.lastRun);
        setPendingActions(statusData.snapshot.pendingOperatorActions ?? []);
      }
      if (jobsData.ok) {
        setHistory(jobsData.history ?? []);
        setFailedJobs(jobsData.failedJobs ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    }
  }, [workspaceHeaders]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runNow = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...workspaceHeaders },
        body: JSON.stringify({ force: true, trigger: "manual" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      setLastRun(data.result as AutomationRun);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  };

  const retryJob = async (failedJobId: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/automation/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...workspaceHeaders },
        body: JSON.stringify({ failedJobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Retry failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  };

  const patchSettings = async (patch: Partial<AutomationSettings>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/automation/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...workspaceHeaders },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setSettings(data.settings as AutomationSettings);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleModule = (jobType: AutomationJobType, enabled: boolean) => {
    if (!settings) return;
    void patchSettings({
      moduleToggles: { ...settings.moduleToggles, [jobType]: enabled },
    });
  };

  const recentJobs: AutomationJob[] = history.flatMap((r) => r.jobs).slice(0, 40);

  return (
    <OpsShell
      badge="P-MVP 4 · Control plane"
      title="Automation Control Plane"
      subtitle="Scheduled AI desk operations — server-side, logged, retryable. No browser required."
      accent="cyan"
      iconLetters="AC"
      activePath="/automation-control"
      nav={[
        { href: "/", label: "← Cockpit" },
        { href: "/worker", label: "Worker" },
        { href: "/actions", label: "Actions" },
        { href: "/command-center", label: "Command center" },
      ]}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void runNow()}
          className="rounded-lg bg-cyan-700/90 px-4 py-2 text-xs font-semibold text-zinc-100 disabled:opacity-50"
        >
          {busy ? "Running…" : "Run automation now"}
        </button>
      }
    >
      <p className="rounded-lg border border-cyan-900/40 bg-cyan-950/20 px-4 py-2 text-xs text-cyan-200/90">
        {AUTOMATION_SAFETY_NOTICE}
      </p>
      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi
          label="Last run"
          value={lastRun?.status ?? "IDLE"}
          hint={
            lastRun?.completedAt
              ? new Date(lastRun.completedAt).toLocaleString()
              : "—"
          }
        />
        <OpsKpi
          label="Paused"
          value={settings?.paused ? "YES" : "NO"}
          hint={settings?.automationEnabled ? "Automation enabled" : "Disabled"}
        />
        <OpsKpi
          label="Failures"
          value={String(failedJobs.length)}
          hint="Retry from history below"
        />
        <OpsKpi
          label="Pending actions"
          value={String(pendingActions.length)}
          hint="From failed jobs + queue refresh"
        />
      </div>

      <section className="desk-panel px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Scheduler controls</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={!settings?.paused}
              disabled={busy || !settings}
              onChange={(e) => void patchSettings({ paused: !e.target.checked })}
            />
            Automation active (not paused)
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={settings?.automationEnabled ?? true}
              disabled={busy || !settings}
              onChange={(e) =>
                void patchSettings({ automationEnabled: e.target.checked })
              }
            />
            Interval runs enabled
          </label>
          <label className="text-xs text-zinc-500">
            Interval (min)
            <input
              type="number"
              min={5}
              max={120}
              className="ml-2 w-16 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-zinc-200"
              value={settings?.intervalMinutes ?? 15}
              disabled={busy}
              onChange={(e) =>
                void patchSettings({ intervalMinutes: Number(e.target.value) })
              }
            />
          </label>
          <p className="text-[10px] text-zinc-600">
            Next: {settings?.nextRunAt ? new Date(settings.nextRunAt).toLocaleString() : "—"}
          </p>
        </div>
      </section>

      <section className="desk-panel px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Module toggles</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {JOB_TYPES.map((jt) => (
            <label key={jt} className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={settings?.moduleToggles[jt] !== false}
                disabled={busy || !settings}
                onChange={(e) => toggleModule(jt, e.target.checked)}
              />
              {AUTOMATION_JOB_LABELS[jt]}
            </label>
          ))}
        </div>
      </section>

      {failedJobs.length > 0 && (
        <section className="desk-panel border-rose-900/40 px-4 py-4">
          <h2 className="text-sm font-semibold text-rose-300">Failures</h2>
          <ul className="mt-3 space-y-2">
            {failedJobs.map((f) => (
              <li
                key={f.failedJobId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-rose-900/30 bg-rose-950/20 px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-medium text-rose-200">
                    {AUTOMATION_JOB_LABELS[f.jobType]}
                  </p>
                  <p className="text-zinc-500">{f.error}</p>
                  <p className="text-[10px] text-zinc-600">
                    {new Date(f.failedAt).toLocaleString()}
                    {f.backoffUntil
                      ? ` · backoff until ${new Date(f.backoffUntil).toLocaleTimeString()}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void retryJob(f.failedJobId)}
                  className="rounded bg-rose-900/60 px-2 py-1 text-[10px] text-rose-100 disabled:opacity-50"
                >
                  Retry
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendingActions.length > 0 && (
        <section className="desk-panel px-4 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">
            Operator actions from automation
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {pendingActions.slice(0, 8).map((a) => (
              <li key={a.actionId}>
                <span className="text-amber-400/90">{a.priority}</span> · {a.title}
              </li>
            ))}
          </ul>
          <Link href="/actions" className="mt-2 inline-block text-[10px] text-cyan-400 hover:underline">
            Open action queue →
          </Link>
        </section>
      )}

      <section className="desk-panel max-h-[400px] overflow-y-auto px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Job history</h2>
        <ul className="mt-3 space-y-1">
          {recentJobs.length === 0 && (
            <li className="text-xs text-zinc-500">No jobs logged yet — run automation once.</li>
          )}
          {recentJobs.map((j) => (
            <li
              key={j.jobId}
              className="flex flex-wrap items-center gap-2 border-b border-zinc-800/60 py-1.5 text-[11px]"
            >
              <span className={`font-semibold ${statusTone(j.status)}`}>{j.status}</span>
              <span className="text-zinc-300">{AUTOMATION_JOB_LABELS[j.jobType]}</span>
              <span className="text-zinc-600">{j.durationMs}ms</span>
              <span className="flex-1 truncate text-zinc-500">{j.resultSummary}</span>
            </li>
          ))}
        </ul>
      </section>
    </OpsShell>
  );
}
