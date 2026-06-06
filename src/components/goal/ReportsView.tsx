"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import GoalErrorBanner from "./GoalErrorBanner";
import GoalShell from "./GoalShell";
import DailySelfReviewPanel from "./DailySelfReviewPanel";
import TradeQualityPanel from "@/components/learning/TradeQualityPanel";
import type { TradeQualitySummary } from "@/lib/trade-quality-score/types";
import LearningInsightsPanel from "./LearningInsightsPanel";
import MissionActivityFeed from "./MissionActivityFeed";
import { useMissionSnapshot } from "./use-mission-snapshot";
import type { DailySelfReviewRecord } from "@/lib/daily-self-review/types";

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
  const { snapshot: m, busy, error, degraded, warnings, refresh } =
    useMissionSnapshot();
  const [digest, setDigest] = useState<string | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);
  const [dailyReview, setDailyReview] = useState<DailySelfReviewRecord | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [tradeQuality, setTradeQuality] = useState<TradeQualitySummary | null>(null);

  const loadDigest = useCallback(async () => {
    setDigestBusy(true);
    try {
      const res = await fetch("/api/mission/digest", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.ok) setDigest(json.digest as string);
    } catch {
      /* optional */
    } finally {
      setDigestBusy(false);
    }
  }, []);

  const loadDailyReview = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-self-review/latest", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.ok) {
        setDailyReview((json.status?.latest as DailySelfReviewRecord | null) ?? null);
      }
    } catch {
      /* optional */
    }
  }, []);

  const runDailyReview = useCallback(async (force = false) => {
    setReviewBusy(true);
    try {
      const res = await fetch("/api/daily-self-review/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const json = await res.json();
      if (res.ok && json.ok && json.record) {
        setDailyReview(json.record as DailySelfReviewRecord);
      }
    } finally {
      setReviewBusy(false);
    }
  }, []);

  const loadTradeQuality = useCallback(async () => {
    try {
      const res = await fetch("/api/trade-quality-score/status", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.ok) {
        setTradeQuality((json.status?.summary as TradeQualitySummary | null) ?? null);
      }
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    void loadDigest();
    void loadDailyReview();
    void loadTradeQuality();
  }, [loadDigest, loadDailyReview, loadTradeQuality, m.lastUpdatedAt]);

  const dailySummary =
    m.closedTrades > 0
      ? `${m.closedTrades} completed trade(s) · ${m.wins}W / ${m.losses}L · net ${usd(m.netPnl)}`
      : "No trades yet — autopilot analyzes every 15 minutes.";

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
      missionSnapshot={m}
      actions={
        <>
          <button
            type="button"
            disabled={digestBusy}
            onClick={() => void loadDigest()}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-50"
          >
            {digestBusy ? "..." : "Load digest"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh(true)}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-50"
          >
            {busy ? "Refreshing..." : "Refresh"}
          </button>
        </>
      }
    >
      <GoalErrorBanner
        error={error}
        degraded={degraded}
        warnings={warnings}
        snapshot={m}
      />

      <Section title="Trade quality score">
        <TradeQualityPanel summary={tradeQuality} />
        <Link href="/learning" className="mt-2 inline-block text-xs text-indigo-300 hover:underline">
          Full trade quality on Learning →
        </Link>
      </Section>

      <Section title="Daily AI self-review">
        <DailySelfReviewPanel
          review={dailyReview}
          busy={reviewBusy}
          onRun={() => void runDailyReview(true)}
        />
      </Section>

      {digest && (
        <Section title="Mission digest">
          <pre className="whitespace-pre-wrap font-mono text-[11px] text-zinc-400">
            {digest}
          </pre>
          {m.notifications.telegramConfigured && (
            <button
              type="button"
              disabled={digestBusy}
              onClick={async () => {
                setDigestBusy(true);
                try {
                  await fetch("/api/mission/digest?send=1", { cache: "no-store" });
                } finally {
                  setDigestBusy(false);
                }
              }}
              className="mt-3 rounded-lg border border-cyan-800/60 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-950/40 disabled:opacity-50"
            >
              Send digest to Telegram
            </button>
          )}
        </Section>
      )}

      <MissionActivityFeed items={m.recentActivity} />
      <LearningInsightsPanel insights={m.learningInsights} />

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
            <Link href="/" className="mt-2 inline-block text-xs text-amber-300 hover:underline">
              Review {m.pendingLearningReview} pending trade(s) on Dashboard →
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
