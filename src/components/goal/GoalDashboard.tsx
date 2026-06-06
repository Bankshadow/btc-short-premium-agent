"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import GoalShell from "./GoalShell";
import type { GoalProgressSnapshot, MissionSnapshot } from "@/lib/goal-engine/types";
import type { CoreEngineRegistrySnapshot } from "@/lib/core-engine-registry/types";
import { emptyMissionSnapshot } from "@/lib/goal-engine/build-mission-snapshot";

interface DashboardResponse {
  ok: boolean;
  goal?: GoalProgressSnapshot;
  mission?: MissionSnapshot;
  engines?: CoreEngineRegistrySnapshot;
  error?: string;
  cycle?: {
    deskRunId: string;
    verdict: string;
    testnetPreviewId: string | null;
  };
}

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const STATUS_COPY: Record<string, string> = {
  IDLE: "Idle",
  ANALYZING: "Analyzing",
  MONITORING: "Monitoring",
  IN_TRADE: "In trade",
  WAITING: "Waiting",
  BLOCKED: "Blocked",
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
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startMessage, setStartMessage] = useState<string | null>(null);

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

  const startAi = useCallback(async () => {
    setStarting(true);
    setError(null);
    setStartMessage(null);
    try {
      const res = await fetch("/api/goal/start-ai", { method: "POST" });
      const json = (await res.json()) as DashboardResponse;
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Start AI failed");
      setData(json);
      const verdict = json.cycle?.verdict ?? json.goal?.lastVerdict ?? "—";
      const preview = json.cycle?.testnetPreviewId;
      setStartMessage(
        preview
          ? `AI cycle complete · verdict ${verdict} · testnet preview ready (double confirm required).`
          : `AI cycle complete · verdict ${verdict}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start AI failed");
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mission = data?.mission ?? emptyMissionSnapshot();
  const goal = data?.goal;
  const engines = data?.engines;
  const risk = goal?.risk;
  const cta = goal?.primaryCta;
  const hasData = mission.dataConnected || mission.totalTrades > 0;

  return (
    <GoalShell
      title="AI Profit Mission"
      subtitle="Track progress from $1,000 to $10,000. Everything else runs in the background."
      activePath="/"
      actions={
        <>
          <button
            type="button"
            disabled={starting || busy}
            onClick={() => void startAi()}
            className="rounded-lg bg-emerald-700/90 px-4 py-2 text-xs font-semibold text-zinc-50 hover:bg-emerald-600 disabled:opacity-50"
          >
            {starting ? "Running AI…" : "Start AI"}
          </button>
          {cta && (
            <Link
              href={cta.href}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900/60"
            >
              {cta.label}
            </Link>
          )}
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

      {startMessage && (
        <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-xs text-emerald-200">
          {startMessage}
        </p>
      )}

      {!hasData && (
        <section className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
          <p className="text-sm text-amber-100">
            {goal?.zeroStateMessage ??
              "Trade data is not connected yet. Run your first AI cycle or connect Binance Testnet."}
          </p>
        </section>
      )}

      {goal?.userActionRequired.items.some((i) => i.severity !== "INFO") ? (
        <section className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300">
            Your action required
          </h2>
          <ul className="space-y-2 text-xs text-amber-100">
            {goal.userActionRequired.items
              .filter((i) => i.severity !== "INFO")
              .map((item) => (
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
        hasData && (
          <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-2 text-xs text-emerald-200/80">
            Human action required:{" "}
            <span className="font-semibold">{mission.humanActionRequired ? "Yes" : "No"}</span>
            {mission.humanActionRequired ? ` — ${mission.nextAction}` : " — AI is running normally."}
          </p>
        )
      )}

      <Card title="Mission · $1,000 → $10,000" tone="good">
        <p className="text-[10px] uppercase tracking-widest text-emerald-400/80">
          AI Profit Mission · {mission.scopeLabel}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-3xl text-zinc-50">{usd(mission.currentEquity)}</p>
            <p className="mt-1 text-xs text-zinc-500">
              Current equity · {usd(mission.remainingToTarget)} left to $10,000
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
          Goal: {usd(mission.startCapital)} → {usd(mission.targetCapital)} · Net PnL{" "}
          {mission.netPnl >= 0 ? "+" : ""}
          {usd(mission.netPnl)}
        </p>
      </Card>

      <Card title="Trading stats">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Total trades" value={String(mission.totalTrades)} />
          <Metric label="Wins" value={String(mission.winTrades)} />
          <Metric label="Losses" value={String(mission.lossTrades)} />
          <Metric label="Win / Loss" value={`${mission.winTrades} / ${mission.lossTrades}`} />
          <Metric label="Win rate" value={`${mission.winRate}%`} />
          <Metric label="Net PnL" value={usd(mission.netPnl)} />
          <Metric label="Realized PnL" value={usd(mission.realizedPnl)} />
          <Metric label="Unrealized PnL" value={usd(mission.unrealizedPnl)} />
          <Metric label="Open positions" value={String(mission.openPositionCount)} />
        </div>
        {!mission.trustReady && (
          <p className="mt-3 text-[11px] text-amber-300/80">
            AI needs {mission.minTradesForTrust} completed trades before its performance can be
            trusted. {mission.totalTrades} done so far.
          </p>
        )}
        {mission.totalTrades === 0 && (
          <p className="mt-3 text-[11px] text-zinc-500">
            No trades recorded yet. Press Start AI or connect Binance Testnet.
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="AI status"
          tone={mission.humanActionRequired ? "alert" : "default"}
        >
          <p className="font-mono text-xl text-zinc-100">
            {STATUS_COPY[mission.aiStatus] ?? mission.aiStatus}
          </p>
          <dl className="mt-3 space-y-1.5 text-xs text-zinc-400">
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-zinc-500">Human action required</dt>
              <dd className={mission.humanActionRequired ? "text-amber-300" : "text-emerald-300"}>
                {mission.humanActionRequired ? "Yes" : "No"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-zinc-500">Next action</dt>
              <dd>{mission.nextAction}</dd>
            </div>
            {mission.lastVerdict && (
              <div className="flex gap-2">
                <dt className="w-36 shrink-0 text-zinc-500">Last verdict</dt>
                <dd>{mission.lastVerdict}</dd>
              </div>
            )}
            {mission.lastCycleAt && (
              <div className="flex gap-2">
                <dt className="w-36 shrink-0 text-zinc-500">Last cycle</dt>
                <dd>{new Date(mission.lastCycleAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>
          <Link href="/ai-status" className="mt-3 inline-block text-xs text-emerald-300 hover:underline">
            Full AI status →
          </Link>
        </Card>

        <Card title="Current position">
          {!mission.currentPositionSummary ? (
            <p className="text-sm text-zinc-500">No active position.</p>
          ) : (
            <div className="space-y-1.5 text-xs text-zinc-400">
              <p className="font-mono text-base text-zinc-100">{mission.currentPositionSummary}</p>
              {goal?.currentPosition && (
                <>
                  <p>Entry: {goal.currentPosition.entryPrice}</p>
                  <p>Mark: {goal.currentPosition.markPrice ?? "—"}</p>
                  {goal.currentPosition.durationLabel && (
                    <p>Duration: {goal.currentPosition.durationLabel}</p>
                  )}
                </>
              )}
              <Link href="/trades" className="mt-2 inline-block text-emerald-300 hover:underline">
                View trade →
              </Link>
            </div>
          )}
        </Card>
      </div>

      {risk && (
        <Card title="Risk & safety" tone={risk.blocker ? "alert" : "default"}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs text-zinc-400">
            <div>
              <p className="text-zinc-500">Live trading</p>
              <p className="text-emerald-300">
                {risk.liveLocked ? "Locked (safe)" : "Enabled in server env"}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Testnet</p>
              <p
                className={
                  risk.testnetStatus.includes("not connected") ? "text-amber-300" : "text-emerald-300"
                }
              >
                {risk.testnetStatus}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Daily loss limit</p>
              <p className="text-zinc-200">{risk.dailyLossLimitLabel}</p>
              <p className="text-[10px] text-zinc-600">{risk.dailyLossStatus}</p>
            </div>
            <div>
              <p className="text-zinc-500">Current blocker</p>
              <p className={risk.blocker ? "text-rose-300" : "text-emerald-300"}>
                {risk.blocker ?? "None"}
              </p>
            </div>
          </div>
        </Card>
      )}

      <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4 text-center">
        <p className="text-xs text-zinc-500">Recommended next step</p>
        <p className="mt-1 text-base font-semibold text-emerald-300">{mission.nextAction}</p>
        {cta && (
          <Link href={cta.href} className="mt-2 inline-block text-xs text-zinc-500 hover:underline">
            {cta.label} →
          </Link>
        )}
      </section>

      {engines && engines.visibleEngines.length > 0 && (
        <Card title="Needs attention">
          <ul className="space-y-2 text-xs">
            {engines.visibleEngines.map((engine) => (
              <li
                key={engine.engineId}
                className="flex items-center justify-between gap-3 rounded border border-zinc-800/70 px-3 py-2"
              >
                <span className="text-zinc-300">
                  <span className="font-semibold">{engine.label}</span> —{" "}
                  {engine.userVisibleSummary}
                </span>
                {(engine.actionHref ?? engine.advancedHref) && (
                  <Link
                    href={engine.actionHref ?? engine.advancedHref ?? "#"}
                    className="shrink-0 text-emerald-300 hover:underline"
                  >
                    {engine.actionLabel ?? "Open"} →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-center text-[10px] text-zinc-600">
        Practice money only. Live trading stays locked. Testnet orders require double confirmation.
      </p>
    </GoalShell>
  );
}
