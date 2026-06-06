"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AutopilotControls from "./AutopilotControls";
import GoalErrorBanner from "./GoalErrorBanner";
import GoalShell from "./GoalShell";
import LearningInsightsPanel from "./LearningInsightsPanel";
import LearningReviewPanel from "./LearningReviewPanel";
import MissionActivityFeed from "./MissionActivityFeed";
import MissionAutopilotHero from "./MissionAutopilotHero";
import StrategyHealthBanner from "./StrategyHealthBanner";
import TestnetTradeModal from "./TestnetTradeModal";
import { useMissionSnapshot } from "./use-mission-snapshot";

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
  const { snapshot: m, busy, error, degraded, warnings, refresh, setSnapshot } =
    useMissionSnapshot();
  const [runningCycle, setRunningCycle] = useState(false);
  const [cycleMessage, setCycleMessage] = useState<string | null>(null);
  const bootstrapAttempted = useRef(false);
  const [tradeModal, setTradeModal] = useState<{
    open: boolean;
    mode: "execute" | "close";
  }>({ open: false, mode: "execute" });

  const runAutopilotCycle = useCallback(
    async (trigger: "manual" | "bootstrap" = "manual") => {
      setRunningCycle(true);
      setCycleMessage(null);
      try {
        const res = await fetch("/api/automation/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger, force: true }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error ?? "Autopilot cycle failed");
        await refresh(true);
        setCycleMessage(
          trigger === "bootstrap"
            ? "First autopilot cycle started — AI will analyze, trade, and learn on schedule."
            : `Cycle ${json.result?.status ?? "complete"}.`,
        );
      } catch (e) {
        setCycleMessage(e instanceof Error ? e.message : "Autopilot cycle failed");
      } finally {
        setRunningCycle(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    if (bootstrapAttempted.current) return;
    if (m.lastCycleAt) return;
    if (m.binanceTestnet.status !== "CONNECTED") return;
    if (!m.automation.enabled || m.automation.paused) return;
    bootstrapAttempted.current = true;
    void runAutopilotCycle("bootstrap");
  }, [
    m.automation.enabled,
    m.automation.paused,
    m.binanceTestnet.status,
    m.lastCycleAt,
    runAutopilotCycle,
  ]);

  const hasData = m.totalTrades > 0 || Boolean(m.lastCycleAt);

  return (
    <GoalShell
      title="AI Profit Mission"
      subtitle="Autopilot analyzes, trades testnet, and learns — $1,000 → $10,000 mission."
      activePath="/"
      missionSnapshot={m}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
        >
          {busy ? "..." : "Refresh"}
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
        onRunNow={() => void runAutopilotCycle("manual")}
      />

      <StrategyHealthBanner strategy={m.strategyHealth} />

      <LearningReviewPanel
        items={m.learningPending}
        pendingCount={m.pendingLearningReview}
        autoLearnEnabled={m.automation.autoLearnEnabled}
        onReviewed={() => void refresh(true)}
      />

      {cycleMessage && (
        <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-xs text-emerald-200">
          {cycleMessage}
        </p>
      )}

      {m.pendingTestnetPreview && (
        <section className="rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-4">
          <p className="text-xs uppercase tracking-wide text-cyan-400/80">
            Testnet preview ready
          </p>
          <p className="mt-1 font-mono text-sm text-zinc-100">
            {m.pendingTestnetPreview.symbol} {m.pendingTestnetPreview.side} · $
            {m.pendingTestnetPreview.notionalUsd}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Expires {new Date(m.pendingTestnetPreview.expiresAt).toLocaleString()} · double
            confirm required before execute.
          </p>
          {m.pendingTestnetPreview.blocked ? (
            <p className="mt-2 text-xs text-rose-300">
              Blocked: {m.pendingTestnetPreview.blockReasons.join("; ")}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setTradeModal({ open: true, mode: "execute" })}
              className="mt-3 rounded-lg bg-cyan-800/70 px-4 py-2 text-xs font-semibold text-zinc-50 hover:bg-cyan-700/70"
            >
              Review testnet order
            </button>
          )}
        </section>
      )}

      {!hasData && (
        <section className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
          <p className="text-sm text-amber-100">{m.aiStatus.nextAction}</p>
        </section>
      )}

      <p className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-4 py-2 text-xs text-zinc-400">
        Human action required:{" "}
        <span className={m.aiStatus.humanActionRequired ? "text-amber-300" : "text-emerald-300"}>
          {m.aiStatus.humanActionRequired ? "Yes" : "No"}
        </span>
        {m.aiStatus.humanActionRequired ? ` — ${m.aiStatus.nextAction}` : ""}
      </p>

      <Card title="Mission · $1,000 → $10,000" tone="good">
        <p className="text-[10px] uppercase tracking-widest text-emerald-400/80">
          AI Profit Mission · {m.scopeLabel}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-3xl text-zinc-50">{usd(m.currentEquity)}</p>
            <p className="mt-1 text-xs text-zinc-500">
              Current equity · {usd(m.remainingToTarget)} left to $10,000
            </p>
          </div>
          <p className="font-mono text-2xl text-emerald-300">{m.progressPct}%</p>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
            style={{ width: `${Math.min(100, Math.max(0, m.progressPct))}%` }}
          />
        </div>
      </Card>

      <Card title="Trading stats">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Metric label="Total trades" value={String(m.closedTrades)} />
          <Metric label="Win / Loss" value={`${m.wins} / ${m.losses}`} />
          <Metric
            label="Win rate"
            value={m.winRate != null ? `${m.winRate}%` : "—"}
          />
          <Metric label="Net PnL" value={usd(m.netPnl)} />
          <Metric label="Realized PnL" value={usd(m.realizedPnl)} />
          <Metric label="Unrealized PnL" value={usd(m.unrealizedPnl)} />
          <Metric label="Max drawdown" value={usd(-m.maxDrawdown)} />
          <Metric label="Open positions" value={String(m.openTrades)} />
        </div>
        {!m.trust.ready && (
          <p className="mt-3 text-[11px] text-amber-300/80">
            AI needs {m.trust.minRequired} completed trades before performance can be trusted.{" "}
            {m.trust.completedTrades} done so far.
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Autopilot schedule" tone="default">
          <p className="text-xs text-zinc-400">
            {m.automation.paused
              ? "Paused — cron cycles will not run until resumed."
              : m.automation.enabled
                ? m.automation.nextRunAt
                  ? `Next scheduled cycle: ${new Date(m.automation.nextRunAt).toLocaleString()}`
                  : "Scheduled cycles active (every 15 min)."
                : "Scheduled cycles disabled."}
          </p>
        </Card>

        <Card title="AI status" tone={m.aiStatus.humanActionRequired ? "alert" : "default"}>
          <p className="font-mono text-xl text-zinc-100">
            {STATUS_COPY[m.aiStatus.state] ?? m.aiStatus.state}
          </p>
          <dl className="mt-3 space-y-1.5 text-xs text-zinc-400">
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-zinc-500">Last action</dt>
              <dd>{m.aiStatus.lastAction}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-zinc-500">Next action</dt>
              <dd>{m.aiStatus.nextAction}</dd>
            </div>
            {m.lastVerdict && (
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-zinc-500">Last verdict</dt>
                <dd>{m.lastVerdict}</dd>
              </div>
            )}
          </dl>
          <Link href="/ai-status" className="mt-3 inline-block text-xs text-emerald-300 hover:underline">
            Full AI status →
          </Link>
        </Card>

        <Card title="Current position">
          {!m.currentPosition ? (
            <p className="text-sm text-zinc-500">No active position.</p>
          ) : (
            <div className="space-y-1.5 text-xs text-zinc-400">
              <p className="font-mono text-base text-zinc-100">{m.currentPosition.summary}</p>
              <p>Entry: {m.currentPosition.entryPrice}</p>
              <p>Mark: {m.currentPosition.markPrice ?? "—"}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Link href="/trades" className="text-emerald-300 hover:underline">
                  View trade →
                </Link>
                {m.currentPosition.canCloseOnTestnet && (
                  <button
                    type="button"
                    onClick={() => setTradeModal({ open: true, mode: "close" })}
                    className="text-amber-300 hover:underline"
                  >
                    Close on testnet →
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title="Risk & safety" tone={m.risk.blocker ? "alert" : "default"}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs text-zinc-400">
          <div>
            <p className="text-zinc-500">Live trading</p>
            <p className="text-emerald-300">
              {m.risk.liveLocked ? "Locked (safe)" : "Unlocked"}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Testnet</p>
            <p
              className={
                m.binanceTestnet.status === "CONNECTED"
                  ? "text-emerald-300"
                  : "text-amber-300"
              }
            >
              {m.binanceTestnet.status} — {m.risk.testnetStatus}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Binance reason</p>
            <p className="text-zinc-300">{m.binanceTestnet.reason}</p>
          </div>
          <div>
            <p className="text-zinc-500">Current blocker</p>
            <p className={m.risk.blocker ? "text-rose-300" : "text-emerald-300"}>
              {m.risk.blocker ?? "None"}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <MissionActivityFeed items={m.recentActivity} compact />
        <LearningInsightsPanel insights={m.learningInsights} compact />
      </div>

      <AutopilotControls
        automation={m.automation}
        onChanged={() => void refresh(true)}
        compact
      />

      <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4 text-center">
        <p className="text-xs text-zinc-500">Recommended next step</p>
        <p className="mt-1 text-base font-semibold text-emerald-300">{m.nextRecommendation}</p>
      </section>

      <p className="text-center text-[10px] text-zinc-600">
        Practice money only. Live trading stays locked.
        {m.automation.autoExecuteEnabled
          ? " Testnet trades run automatically when autopilot sees TRADE."
          : " Manual testnet orders still need double confirmation."}
      </p>

      <TestnetTradeModal
        open={tradeModal.open}
        mode={tradeModal.mode}
        preview={m.pendingTestnetPreview}
        position={m.currentPosition}
        onClose={() => setTradeModal((s) => ({ ...s, open: false }))}
        onSuccess={() => {
          setTradeModal((s) => ({ ...s, open: false }));
          void refresh();
        }}
      />
    </GoalShell>
  );
}
