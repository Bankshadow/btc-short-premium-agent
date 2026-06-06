"use client";

import Link from "next/link";
import GoalShell from "./GoalShell";
import { useMissionSnapshot } from "./use-mission-snapshot";

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
  const { snapshot: m, busy, error, refresh } = useMissionSnapshot();

  const dailySummary =
    m.closedTrades > 0
      ? `${m.closedTrades} completed trade(s) · ${m.wins}W / ${m.losses}L · net ${usd(m.netPnl)}`
      : "No trades yet today. Run your first AI cycle to start.";

  const weeklySummary = m.trust.ready
    ? `Performance is statistically meaningful (${m.trust.completedTrades} trades). Win rate ${m.winRate ?? 0}%.`
    : `${m.trust.completedTrades} / ${m.trust.minRequired} completed trades — AI needs ${m.trust.minRequired} before weekly performance can be trusted.`;

  const learningSummary =
    m.learnedTrades > 0
      ? `${m.learnedTrades} trade(s) learned · ${m.pendingLearningReview} pending review.`
      : `${m.trust.completedTrades} / ${m.trust.minRequired} completed trades for trusted performance.`;

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
          {busy ? "Refreshing..." : "Refresh"}
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
          <p className="mt-2 text-xs text-zinc-500">
            AI: {m.aiStatus.state} — {m.aiStatus.lastAction}
          </p>
        </Section>

        <Section title="Weekly summary">
          <p>{weeklySummary}</p>
        </Section>

        <Section title="Goal progress">
          <ul className="space-y-1 text-xs">
            <li>
              Mission: {usd(m.startCapital)} → {usd(m.targetCapital)}
            </li>
            <li>Current equity: {usd(m.currentEquity)}</li>
            <li>Progress: {m.progressPct}%</li>
            <li>Remaining: {usd(m.remainingToTarget)}</li>
          </ul>
        </Section>

        <Section title="PnL summary">
          <ul className="space-y-1 text-xs">
            <li>Net PnL: {usd(m.netPnl)}</li>
            <li>Realized: {usd(m.realizedPnl)}</li>
            <li>Unrealized: {usd(m.unrealizedPnl)}</li>
            <li>Max drawdown: {usd(-m.maxDrawdown)}</li>
          </ul>
        </Section>

        <Section title="Trades summary">
          <ul className="space-y-1 text-xs">
            <li>Total closed: {m.closedTrades}</li>
            <li>
              Wins / Losses / Breakeven: {m.wins} / {m.losses} / {m.breakeven}
            </li>
            <li>Win rate: {m.winRate != null ? `${m.winRate}%` : "—"}</li>
            <li>Open positions: {m.openTrades}</li>
          </ul>
          <Link href="/trades" className="mt-2 inline-block text-xs text-emerald-300 hover:underline">
            View all trades →
          </Link>
        </Section>

        <Section title="AI learning summary">
          <p>{learningSummary}</p>
          {m.pendingLearningReview > 0 && (
            <Link href="/learning" className="mt-2 inline-block text-xs text-amber-300 hover:underline">
              Review {m.pendingLearningReview} pending trade(s) →
            </Link>
          )}
        </Section>
      </div>

      <Section title="Next recommendation">
        <p>{m.nextRecommendation}</p>
        {m.binanceTestnet.status !== "CONNECTED" && (
          <Link href="/binance-testnet" className="mt-2 inline-block text-sm font-semibold text-emerald-300 hover:underline">
            Connect Binance Testnet →
          </Link>
        )}
      </Section>
    </GoalShell>
  );
}
