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

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const STATUS_COPY: Record<string, string> = {
  IDLE: "Idle — not started",
  ANALYZING: "Reviewing the market",
  MONITORING: "Watching for a setup",
  IN_TRADE: "Managing a trade",
  WAITING: "Paused — waiting for you",
  BLOCKED: "Paused by a safety blocker",
};

function Card({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "alert" | "good";
}) {
  const border =
    tone === "alert"
      ? "border-rose-900/50"
      : tone === "good"
        ? "border-emerald-900/50"
        : "border-zinc-800/80";
  return (
    <section className={`rounded-xl border ${border} bg-zinc-950/60 p-4`}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 font-mono text-lg text-zinc-100">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-zinc-600">{hint}</p>}
    </div>
  );
}

export default function GoalDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/goal-dashboard", { cache: "no-store" });
      const json = (await res.json()) as DashboardResponse;
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load dashboard");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setBusy(false);
    }
  }, []);

  const setAi = useCallback(
    async (paused: boolean) => {
      setActionBusy(true);
      setNotice(null);
      setError(null);
      try {
        const res = await fetch("/api/automation/pause", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused, automationEnabled: !paused }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error ?? "Action failed");
        setNotice(paused ? "AI paused. It will not trade until resumed." : "AI started. It will review the market on schedule.");
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setActionBusy(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const goal = data?.goal;
  const engines = data?.engines;
  const mission = goal?.mission;
  const stats = goal?.tradeStats;
  const ai = goal?.aiActivity;
  const pos = goal?.currentPosition;
  const risk = goal?.risk;

  return (
    <GoalShell
      title="$1,000 → $10,000"
      subtitle="Your AI is working toward turning $1,000 of practice money into $10,000. This page shows the only things you need to know."
      activePath="/"
      actions={
        <>
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => void setAi(false)}
            className="rounded-lg bg-emerald-700/90 px-3 py-2 text-xs font-semibold text-zinc-50 hover:bg-emerald-600 disabled:opacity-50"
          >
            Start AI
          </button>
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => void setAi(true)}
            className="rounded-lg border border-amber-700/50 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-950/40 disabled:opacity-50"
          >
            Pause AI
          </button>
          <Link
            href="/trades"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900/60"
          >
            View Trades
          </Link>
          <Link
            href="/ai-status"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900/60"
          >
            View Reasoning
          </Link>
          <Link
            href="/settings"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900/60"
          >
            Settings
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            {busy ? "..." : "Refresh"}
          </button>
        </>
      }
    >
      {error && (
        <p className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-4 py-2 text-xs text-emerald-200">
          {notice}
        </p>
      )}

      {goal?.userActionRequired.items.length ? (
        <section className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300">
            Action needed
          </h2>
          <ul className="space-y-2 text-xs text-amber-100">
            {goal.userActionRequired.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{item.title}</span> — {item.detail}
                </span>
                {item.href && (
                  <Link href={item.href} className="shrink-0 text-emerald-300 hover:underline">
                    Open →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        goal && (
          <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-2 text-xs text-emerald-200/80">
            Nothing needs your attention right now. AI will alert you if it does.
          </p>
        )
      )}

      {/* Mission Card */}
      {mission && (
        <Card title="Mission · $1,000 → $10,000" tone="good">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-3xl text-zinc-50">{usd(mission.currentEquity)}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {goal?.scopeLabel} · {usd(mission.remainingToTarget)} left to reach $10,000
              </p>
            </div>
            <p className="font-mono text-2xl text-emerald-300">{mission.progressPct}%</p>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
              style={{ width: `${Math.min(100, Math.max(0, mission.progressPct))}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">
            Net result so far: {mission.netPnl >= 0 ? "+" : ""}
            {usd(mission.netPnl)} · current multiple {mission.currentMultiple}x of 10x goal
          </p>
        </Card>
      )}

      {/* Performance Cards */}
      {stats && (
        <Card title="Performance">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Total trades" value={String(stats.totalTrades)} />
            <Metric label="Wins" value={String(stats.winTrades)} />
            <Metric label="Losses" value={String(stats.lossTrades)} />
            <Metric label="Win rate" value={`${stats.winRate}%`} />
            <Metric label="Net PnL" value={usd(mission?.netPnl ?? 0)} />
            <Metric label="Max drawdown" value={usd(-stats.maxDrawdown)} />
          </div>
          {!goal?.trustReady && (
            <p className="mt-3 text-[11px] text-amber-300/80">
              AI needs {goal?.minTradesForTrust} completed trades before its performance can be
              trusted. {stats.totalTrades} done so far.
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* AI Status Card */}
        {ai && (
          <Card title="What AI is doing" tone={ai.humanActionRequired ? "alert" : "default"}>
            <p className="font-mono text-lg text-zinc-100">{STATUS_COPY[ai.status] ?? ai.status}</p>
            <dl className="mt-3 space-y-1.5 text-xs text-zinc-400">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-zinc-500">Last action</dt>
                <dd>{ai.lastAction}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-zinc-500">Position</dt>
                <dd>{ai.currentPositionSummary}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-zinc-500">Next action</dt>
                <dd>{ai.nextPlannedAction}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-zinc-500">Your action?</dt>
                <dd className={ai.humanActionRequired ? "text-amber-300" : "text-emerald-300"}>
                  {ai.humanActionRequired ? "Yes — see action needed above" : "No"}
                </dd>
              </div>
            </dl>
            <Link href="/ai-status" className="mt-3 inline-block text-xs text-emerald-300 hover:underline">
              See full reasoning →
            </Link>
          </Card>
        )}

        {/* Current Position Card */}
        <Card title="Current position">
          {!pos ? (
            <p className="text-xs text-zinc-500">No open position right now.</p>
          ) : (
            <div className="space-y-1.5 text-xs text-zinc-400">
              <p className="font-mono text-base text-zinc-100">
                {pos.symbol} · {pos.side}
              </p>
              <p>Environment: {pos.environment}</p>
              <p>Entry: {pos.entryPrice}</p>
              <p>Mark: {pos.markPrice ?? "—"}</p>
              <p className={pos.unrealizedPnlUsd >= 0 ? "text-emerald-300" : "text-rose-300"}>
                Unrealized: {pos.unrealizedPnlUsd >= 0 ? "+" : ""}
                {usd(pos.unrealizedPnlUsd)}
              </p>
              <div className="mt-2 flex gap-2">
                <Link href="/trades" className="rounded border border-zinc-700 px-2 py-1 text-zinc-200 hover:bg-zinc-900/60">
                  View
                </Link>
                {pos.canCloseOnTestnet && (
                  <Link
                    href="/testnet-monitor"
                    className="rounded border border-amber-800/50 px-2 py-1 text-amber-200 hover:bg-amber-950/40"
                  >
                    Close on testnet
                  </Link>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Risk Card */}
      {risk && (
        <Card title="Risk & safety" tone={risk.blocker ? "alert" : "default"}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs text-zinc-400">
            <div>
              <p className="text-zinc-500">Daily loss</p>
              <p className="text-zinc-200">{risk.dailyLossStatus}</p>
            </div>
            <div>
              <p className="text-zinc-500">Open risk</p>
              <p className="text-zinc-200">{usd(risk.openRiskUsd)}</p>
            </div>
            <div>
              <p className="text-zinc-500">Live trading</p>
              <p className="text-zinc-200">{risk.liveLocked ? "Locked (safe)" : "Enabled in server env"}</p>
            </div>
            <div>
              <p className="text-zinc-500">Blocker</p>
              <p className={risk.blocker ? "text-rose-300" : "text-emerald-300"}>
                {risk.blocker ?? "None"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Background engines — only show when important */}
      {engines && engines.visibleEngines.length > 0 && (
        <Card title="Background engines that need attention">
          <ul className="space-y-2 text-xs">
            {engines.visibleEngines.map((engine) => (
              <li
                key={engine.engineId}
                className="flex items-center justify-between gap-3 rounded border border-zinc-800/70 px-3 py-2"
              >
                <span className="text-zinc-300">
                  <span className="font-semibold">{engine.label}</span> — {engine.summary}
                  {engine.importantOutput && (
                    <span className="block text-[11px] text-amber-300/80">{engine.importantOutput}</span>
                  )}
                </span>
                {engine.advancedHref && (
                  <Link href={engine.advancedHref} className="shrink-0 text-emerald-300 hover:underline">
                    Open →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-center text-[10px] text-zinc-600">
        Practice money only. AI cannot enable live trading or auto-execute live orders. Testnet
        actions still require double confirmation.
      </p>
    </GoalShell>
  );
}
