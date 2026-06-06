"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import GoalShell from "./GoalShell";
import type { MissionSnapshot } from "@/lib/goal-engine/types";
import { emptyMissionSnapshot } from "@/lib/goal-engine/build-mission-snapshot";

interface DashboardResponse {
  ok: boolean;
  mission?: MissionSnapshot;
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
  const [mission, setMission] = useState<MissionSnapshot>(emptyMissionSnapshot());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/goal-dashboard", { cache: "no-store" });
      const json = (await res.json()) as DashboardResponse;
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load reports");
      if (json.mission) setMission(json.mission);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dailySummary =
    mission.totalTrades > 0
      ? `${mission.totalTrades} completed trade(s) · ${mission.winTrades}W / ${mission.lossTrades}L · net ${usd(mission.netPnl)}`
      : "No trades yet. Run your first AI cycle to start.";

  const weeklySummary = mission.trustReady
    ? `Performance is statistically meaningful (${mission.totalTrades} trades). Win rate ${mission.winRate}%.`
    : `AI needs ${mission.minTradesForTrust} completed trades before weekly performance can be trusted. ${mission.totalTrades} so far.`;

  const learningSummary =
    mission.learnedTrades > 0
      ? `${mission.learnedTrades} trade(s) learned · ${mission.pendingLearningReview} pending review.`
      : mission.trustReady
        ? "AI learning is on track — enough trades to evaluate performance."
        : `AI needs ${mission.minTradesForTrust} completed trades before its performance can be trusted.`;

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

      <p className="text-[11px] text-zinc-600">
        Reports use the same mission snapshot as the dashboard ({mission.scopeLabel}).
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Daily summary">
          <p>{dailySummary}</p>
          <p className="mt-2 text-xs text-zinc-500">
            AI status: {mission.aiStatus} · last updated{" "}
            {new Date(mission.lastUpdatedAt).toLocaleString()}
          </p>
        </Section>

        <Section title="Weekly summary">
          <p>{weeklySummary}</p>
        </Section>

        <Section title="Goal progress">
          <ul className="space-y-1 text-xs">
            <li>
              Mission: {usd(mission.startCapital)} → {usd(mission.targetCapital)}
            </li>
            <li>Current equity: {usd(mission.currentEquity)}</li>
            <li>Progress: {mission.progressPct}%</li>
            <li>Remaining: {usd(mission.remainingToTarget)}</li>
          </ul>
        </Section>

        <Section title="PnL summary">
          <ul className="space-y-1 text-xs">
            <li>Net PnL: {usd(mission.netPnl)}</li>
            <li>Realized: {usd(mission.realizedPnl)}</li>
            <li>Unrealized: {usd(mission.unrealizedPnl)}</li>
          </ul>
        </Section>

        <Section title="Trades summary">
          <ul className="space-y-1 text-xs">
            <li>Total closed: {mission.totalTrades}</li>
            <li>
              Wins / Losses / Breakeven: {mission.winTrades} / {mission.lossTrades} /{" "}
              {mission.breakevenTrades}
            </li>
            <li>Win rate: {mission.winRate}%</li>
            <li>Open positions: {mission.openPositionCount}</li>
          </ul>
          <Link href="/trades" className="mt-2 inline-block text-xs text-emerald-300 hover:underline">
            View all trades →
          </Link>
        </Section>

        <Section title="AI learning summary">
          <p>{learningSummary}</p>
          {mission.pendingLearningReview > 0 && (
            <Link href="/learning" className="mt-2 inline-block text-xs text-amber-300 hover:underline">
              Review {mission.pendingLearningReview} pending trade(s) →
            </Link>
          )}
        </Section>
      </div>

      <Section title="Next recommendation">
        <p>{mission.nextAction}</p>
        <Link
          href={mission.primaryCtaHref}
          className="mt-2 inline-block text-sm font-semibold text-emerald-300 hover:underline"
        >
          {mission.primaryCtaLabel} →
        </Link>
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
