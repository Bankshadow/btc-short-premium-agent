"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import GoalShell from "./GoalShell";
import type { GoalProgressSnapshot } from "@/lib/goal-engine/types";

interface DashboardResponse {
  ok: boolean;
  goal?: GoalProgressSnapshot;
  error?: string;
}

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      <div className="mt-3 text-sm text-zinc-300">{children}</div>
    </section>
  );
}

export default function ReportsView() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/goal-dashboard", { cache: "no-store" });
      const json = (await res.json()) as DashboardResponse;
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load reports");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const goal = data?.goal;
  const mission = goal?.mission;
  const stats = goal?.tradeStats;
  const equity = goal?.equity;

  const dailySummary =
    stats && stats.totalTrades > 0
      ? `${stats.totalTrades} closed trade(s) · ${stats.winTrades}W / ${stats.lossTrades}L · net ${usd(equity?.netPnl ?? 0)}`
      : "No trades yet today. Run your first AI cycle to start.";

  const weeklySummary = goal?.trustReady
    ? `Performance is statistically meaningful (${stats?.totalTrades} trades). Win rate ${stats?.winRate}%.`
    : `AI needs ${goal?.minTradesForTrust ?? 12} completed trades before weekly performance can be trusted. ${stats?.totalTrades ?? 0} so far.`;

  const learningSummary = goal?.trustReady
    ? "AI learning is on track — enough trades to evaluate performance."
    : `AI needs ${goal?.minTradesForTrust ?? 12} completed trades before its performance can be trusted.`;

  const nextRecommendation = goal?.primaryCta
    ? `${goal.primaryCta.label}: ${goal.primaryCta.description}`
    : "Keep AI running on testnet and review trades as they close.";

  return (
    <GoalShell
      title="Reports"
      subtitle="Daily and weekly summaries, goal progress, and what AI recommends next."
      activePath="/reports"
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Daily summary">
          <p>{dailySummary}</p>
          {goal?.aiActivity && (
            <p className="mt-2 text-xs text-zinc-500">
              AI status: {goal.aiActivity.status} — {goal.aiActivity.lastAction}
            </p>
          )}
        </Section>

        <Section title="Weekly summary">
          <p>{weeklySummary}</p>
        </Section>

        <Section title="Goal progress">
          {mission ? (
            <ul className="space-y-1 text-xs">
              <li>
                Mission: {usd(mission.startCapital)} → {usd(mission.targetCapital)}
              </li>
              <li>Current equity: {usd(mission.currentEquity)}</li>
              <li>Progress: {mission.progressPct}%</li>
              <li>Remaining: {usd(mission.remainingToTarget)}</li>
            </ul>
          ) : (
            <p className="text-zinc-500">Loading…</p>
          )}
        </Section>

        <Section title="PnL summary">
          {equity ? (
            <ul className="space-y-1 text-xs">
              <li>Net PnL: {usd(equity.netPnl)}</li>
              <li>Realized: {usd(equity.realizedPnl)}</li>
              <li>Unrealized: {usd(equity.unrealizedPnl)}</li>
              <li>Max drawdown: {usd(-(stats?.maxDrawdown ?? 0))}</li>
            </ul>
          ) : (
            <p className="text-zinc-500">No PnL data yet.</p>
          )}
        </Section>

        <Section title="Trades summary">
          {stats ? (
            <ul className="space-y-1 text-xs">
              <li>Total: {stats.totalTrades}</li>
              <li>Wins / Losses / Breakeven: {stats.winTrades} / {stats.lossTrades} / {stats.breakevenTrades}</li>
              <li>Win rate: {stats.winRate}%</li>
            </ul>
          ) : (
            <p className="text-zinc-500">No trades recorded yet.</p>
          )}
          <Link href="/trades" className="mt-2 inline-block text-xs text-emerald-300 hover:underline">
            View all trades →
          </Link>
        </Section>

        <Section title="AI learning summary">
          <p>{learningSummary}</p>
        </Section>
      </div>

      <Section title="Next recommendation">
        <p>{nextRecommendation}</p>
        {goal?.primaryCta && (
          <Link
            href={goal.primaryCta.href}
            className="mt-2 inline-block text-sm font-semibold text-emerald-300 hover:underline"
          >
            {goal.primaryCta.label} →
          </Link>
        )}
      </Section>

      <p className="text-[11px] text-zinc-600">
        Need detailed export reports?{" "}
        <Link href="/summary" className="text-emerald-300 hover:underline">
          Open advanced reports
        </Link>
        .
      </p>
    </GoalShell>
  );
}
