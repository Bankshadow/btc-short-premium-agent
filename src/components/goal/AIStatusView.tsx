"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AutopilotControls from "./AutopilotControls";
import GoalErrorBanner from "./GoalErrorBanner";
import GoalShell from "./GoalShell";
import MissionAutopilotHero from "./MissionAutopilotHero";
import type { CoreEngineRegistrySnapshot } from "@/lib/core-engine-registry/types";
import { useMissionSnapshot } from "./use-mission-snapshot";

const STATUS_COPY: Record<string, string> = {
  IDLE: "Idle",
  ANALYZING: "Analyzing",
  MONITORING: "Monitoring",
  IN_TRADE: "In trade",
  WAITING: "Waiting",
  BLOCKED: "Blocked",
};

export default function AIStatusView() {
  const { snapshot: m, busy, error, degraded, warnings, refresh } =
    useMissionSnapshot();
  const [engines, setEngines] = useState<CoreEngineRegistrySnapshot | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [runningCycle, setRunningCycle] = useState(false);

  const loadEngines = useCallback(async () => {
    try {
      const res = await fetch("/api/goal-dashboard", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.ok && json.engines) {
        setEngines(json.engines as CoreEngineRegistrySnapshot);
      }
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    void loadEngines();
  }, [loadEngines]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), loadEngines()]);
  }, [refresh, loadEngines]);

  const runAutopilotCycle = useCallback(async () => {
    setRunningCycle(true);
    try {
      const res = await fetch("/api/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual", force: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Run failed");
      await refreshAll();
    } finally {
      setRunningCycle(false);
    }
  }, [refreshAll]);

  return (
    <GoalShell
      title="AI Status"
      subtitle="Autopilot status, engine health, and what runs every 15 minutes in the background."
      activePath="/ai-status"
      missionSnapshot={m}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void refreshAll()}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-50"
        >
          {busy ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      <GoalErrorBanner
        error={error}
        degraded={degraded}
        warnings={warnings}
        snapshot={m}
      />

      <MissionAutopilotHero
        snapshot={m}
        running={runningCycle}
        onRunNow={() => void runAutopilotCycle()}
      />

      <AutopilotControls
        automation={m.automation}
        onChanged={() => void refreshAll()}
      />

      {m.pendingTestnetPreview && (
        <section className="rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-4">
          <p className="text-xs uppercase tracking-wide text-cyan-400/80">
            Awaiting your confirmation
          </p>
          <p className="mt-1 font-mono text-sm text-zinc-100">
            {m.pendingTestnetPreview.symbol} {m.pendingTestnetPreview.side} · $
            {m.pendingTestnetPreview.notionalUsd}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Testnet preview expires{" "}
            {new Date(m.pendingTestnetPreview.expiresAt).toLocaleString()}.
          </p>
          {!m.pendingTestnetPreview.blocked && (
            <Link href="/" className="mt-2 inline-block text-xs text-cyan-300 hover:underline">
              Review and execute on Dashboard →
            </Link>
          )}
        </section>
      )}

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Current mode</p>
        <p className="mt-1 font-mono text-2xl text-zinc-50">
          {STATUS_COPY[m.aiStatus.state] ?? m.aiStatus.state}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-xs text-zinc-400">
          <div>
            <dt className="text-zinc-500">Last cycle</dt>
            <dd className="mt-0.5 text-zinc-200">
              {m.lastCycleAt
                ? new Date(m.lastCycleAt).toLocaleString()
                : "No cycle has run yet."}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Last verdict</dt>
            <dd className="mt-0.5 text-zinc-200">{m.lastVerdict ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Latest decision log</dt>
            <dd className="mt-0.5 font-mono text-zinc-200">
              {m.latestDecisionLogId ? (
                <Link href={`/trades/${m.latestDecisionLogId}`} className="text-emerald-300 hover:underline">
                  {m.latestDecisionLogId.slice(0, 20)}…
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Desk run</dt>
            <dd className="mt-0.5 font-mono text-zinc-200">{m.lastDeskRunId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Last action</dt>
            <dd className="mt-0.5 text-zinc-200">{m.aiStatus.lastAction}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Next action</dt>
            <dd className="mt-0.5 text-zinc-200">{m.aiStatus.nextAction}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Human action required</dt>
            <dd className={`mt-0.5 ${m.aiStatus.humanActionRequired ? "text-amber-300" : "text-emerald-300"}`}>
              {m.aiStatus.humanActionRequired ? "Yes" : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Current blocker</dt>
            <dd className={`mt-0.5 ${m.risk.blocker ? "text-rose-300" : "text-emerald-300"}`}>
              {m.risk.blocker ?? "None"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Binance testnet</dt>
            <dd className={`mt-0.5 ${m.binanceTestnet.status === "CONNECTED" ? "text-emerald-300" : "text-amber-300"}`}>
              {m.binanceTestnet.status} — {m.binanceTestnet.reason}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Engines needing attention</dt>
            <dd className="mt-0.5 text-zinc-200">{m.enginesNeedingAttention}</dd>
          </div>
        </dl>
      </section>

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

      <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4">
        <p className="text-xs text-zinc-500">Next recommendation</p>
        <p className="mt-1 text-sm text-emerald-300">{m.nextRecommendation}</p>
        <Link href="/" className="mt-2 inline-block text-xs text-zinc-400 hover:underline">
          Mission autopilot on Dashboard →
        </Link>
      </section>

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
