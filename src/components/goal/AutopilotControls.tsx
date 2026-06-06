"use client";

import { useCallback, useState } from "react";
import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";

export default function AutopilotControls({
  automation,
  onChanged,
  compact = false,
}: {
  automation: MissionFlowSnapshot["automation"];
  onChanged: () => void | Promise<void>;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const res = await fetch("/api/automation/pause", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error ?? "Automation update failed");
        setMessage("Autopilot settings updated.");
        await onChanged();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Automation update failed");
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const runNow = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual", force: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Run failed");
      setMessage(`Cycle ${json.result?.status ?? "submitted"}.`);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }, [onChanged]);

  const statusLabel = !automation.enabled
    ? "Disabled"
    : automation.paused
      ? "Paused"
      : automation.lastRunStatus === "RUNNING"
        ? "Running"
        : "Active";

  return (
    <section
      className={
        compact
          ? "rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-3"
          : "rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Background autopilot
          </p>
          <p className="mt-1 font-mono text-lg text-zinc-100">{statusLabel}</p>
        </div>
        <p className="text-[11px] text-zinc-500">
          Every {automation.intervalMinutes} min via cron
        </p>
      </div>

      <dl className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Last run</dt>
          <dd>
            {automation.lastRunAt
              ? new Date(automation.lastRunAt).toLocaleString()
              : "—"}
            {automation.lastRunStatus ? ` · ${automation.lastRunStatus}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Next run</dt>
          <dd>
            {automation.paused || !automation.enabled
              ? "—"
              : automation.nextRunAt
                ? new Date(automation.nextRunAt).toLocaleString()
                : "Scheduled after next cron tick"}
          </dd>
        </div>
        {automation.lastTrigger && (
          <div>
            <dt className="text-zinc-500">Last trigger</dt>
            <dd>{automation.lastTrigger}</dd>
          </div>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runNow()}
          className="rounded-lg bg-emerald-800/70 px-3 py-1.5 text-xs font-semibold text-zinc-50 hover:bg-emerald-700/70 disabled:opacity-50"
        >
          Run cycle now
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ paused: !automation.paused })}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-50"
        >
          {automation.paused ? "Resume autopilot" : "Pause autopilot"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ automationEnabled: !automation.enabled })}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-50"
        >
          {automation.enabled ? "Disable schedule" : "Enable schedule"}
        </button>
      </div>

      {message && <p className="mt-2 text-xs text-emerald-300">{message}</p>}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  );
}
