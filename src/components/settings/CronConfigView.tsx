"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import GoalShell from "@/components/goal/GoalShell";
import { useServerCronTick } from "@/hooks/useServerCronTick";
import type { AgentRosterEntry } from "@/lib/agents/agent-roster";
import { CRON_INTERVAL_PRESETS } from "@/lib/automation-control-plane/cron-config";

interface CronConfig {
  automationEnabled: boolean;
  paused: boolean;
  intervalMinutes: number;
  minIntervalMinutes: number;
  maxIntervalMinutes: number;
  githubCronMinMinutes: number;
  lastRunAt: string | null;
  nextDueInMs: number;
  primaryMode?: string;
  testnetPrimary?: boolean;
  spineJobs?: string[] | null;
  journalPersistenceConfigured?: boolean;
  scheduleNotes: {
    githubActionsNote: string;
    clientPollNote: string;
  };
}

interface AgentsSummary {
  tradingDeskCount: number;
  parallelReviewCount: number;
  totalPrimaryAgents: number;
  tradingDesk: AgentRosterEntry[];
  parallelReview: AgentRosterEntry[];
  note: string;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "due now";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min}m ${rem}s` : `${min}m`;
}

function layerTone(layer: AgentRosterEntry["layer"]): string {
  switch (layer) {
    case "research":
      return "text-sky-300";
    case "strategy":
      return "text-emerald-300";
    case "thesis":
      return "text-amber-300";
    case "risk":
      return "text-rose-300";
    case "moderator":
      return "text-violet-300";
    case "parallel":
      return "text-cyan-300";
    default:
      return "text-zinc-300";
  }
}

export default function CronConfigView() {
  const [config, setConfig] = useState<CronConfig | null>(null);
  const [agents, setAgents] = useState<AgentsSummary | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState(15);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/automation/cron-config", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Load failed");
      setConfig(json.config);
      setAgents(json.agents);
      setSelectedMinutes(json.config.intervalMinutes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useServerCronTick({
    enabled: Boolean(config?.automationEnabled),
    paused: Boolean(config?.paused),
    intervalMinutes: config?.intervalMinutes ?? selectedMinutes,
  });

  const save = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/automation/cron-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalMinutes: selectedMinutes }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Save failed");
      setConfig(json.config);
      setMessage(`Saved — automation every ${json.config.intervalMinutes} min.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/automation/cron-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Run failed");
      setMessage(`Cycle ${json.tick?.run?.status ?? json.tick?.outcome ?? "done"}.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <GoalShell
      title="Automation & Cron"
      subtitle="Configure how often AI scans markets and runs testnet autopilot."
      activePath="/settings/cron"
    >
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Check interval
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Minimum {config?.minIntervalMinutes ?? 1} minute. Presets below or enter a custom
              value (1–{config?.maxIntervalMinutes ?? 120}).
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {CRON_INTERVAL_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMinutes(m)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    selectedMinutes === m
                      ? "bg-emerald-600 text-white"
                      : "border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>

            <label className="mt-4 block text-xs text-zinc-500">
              Custom (minutes)
              <input
                type="number"
                min={1}
                max={120}
                value={selectedMinutes}
                onChange={(e) => setSelectedMinutes(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
              />
            </label>

            {config && selectedMinutes < config.githubCronMinMinutes && (
              <p className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                Intervals under {config.githubCronMinMinutes} min need this page or Goal dashboard
                open (client polling). GitHub Actions still pings every{" "}
                {config.githubCronMinMinutes} min as backup.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Save interval
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runNow()}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-400 disabled:opacity-50"
              >
                Run cycle now
              </button>
              <Link
                href="/automation-control"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Advanced jobs →
              </Link>
            </div>

            {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
            {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 text-sm text-zinc-400">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Schedule status
            </h2>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-zinc-500">Last run</dt>
                <dd className="font-mono text-zinc-200">
                  {config?.lastRunAt
                    ? new Date(config.lastRunAt).toLocaleString()
                    : "Never"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Next due</dt>
                <dd className="font-mono text-zinc-200">
                  {config ? formatDuration(config.nextDueInMs) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Primary loop</dt>
                <dd className="text-zinc-200">
                  {config?.testnetPrimary ? "Testnet perp spine" : config?.primaryMode ?? "Full desk"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Journal persist</dt>
                <dd className={config?.journalPersistenceConfigured ? "text-emerald-300" : "text-amber-300"}>
                  {config?.journalPersistenceConfigured ? "Configured" : "Ephemeral (Vercel)"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Autopilot</dt>
                <dd className="text-zinc-200">
                  {config?.paused
                    ? "Paused"
                    : config?.automationEnabled
                      ? "Enabled"
                      : "Disabled"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Server tick</dt>
                <dd className="font-mono text-xs text-zinc-300">GET /api/cron/tick</dd>
              </div>
            </dl>
            {config?.spineJobs && config.spineJobs.length > 0 && (
              <p className="mt-3 text-xs text-zinc-500">
                Spine: {config.spineJobs.join(" → ")}
              </p>
            )}
            {config?.scheduleNotes && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
                <li>{config.scheduleNotes.githubActionsNote}</li>
                <li>{config.scheduleNotes.clientPollNote}</li>
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              AI agents
            </h2>
            <p className="mt-2 text-3xl font-bold text-zinc-50">
              {agents?.totalPrimaryAgents ?? 18}
              <span className="ml-2 text-sm font-normal text-zinc-500">roles / cycle</span>
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Desk {agents?.tradingDeskCount ?? 12} · Parallel review{" "}
              {agents?.parallelReviewCount ?? 6}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-zinc-400">{agents?.note}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5">
            <h3 className="text-xs font-semibold uppercase text-zinc-500">Trading desk</h3>
            <ul className="mt-2 space-y-2">
              {(agents?.tradingDesk ?? []).map((a) => (
                <li key={a.id} className="text-xs">
                  <span className={`font-medium ${layerTone(a.layer)}`}>{a.name}</span>
                  <span className="block text-zinc-500">{a.role}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5">
            <h3 className="text-xs font-semibold uppercase text-zinc-500">Parallel review</h3>
            <ul className="mt-2 space-y-2">
              {(agents?.parallelReview ?? []).map((a) => (
                <li key={a.id} className="text-xs">
                  <span className={`font-medium ${layerTone(a.layer)}`}>{a.name}</span>
                  <span className="block text-zinc-500">{a.role}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </GoalShell>
  );
}
