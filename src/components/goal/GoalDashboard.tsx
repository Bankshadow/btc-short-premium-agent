"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import GoalShell from "./GoalShell";
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
  const { snapshot: m, busy, error, refresh, setSnapshot } = useMissionSnapshot();
  const [starting, setStarting] = useState(false);
  const [startMessage, setStartMessage] = useState<string | null>(null);

  const startAi = useCallback(async () => {
    setStarting(true);
    setStartMessage(null);
    try {
      const res = await fetch("/api/goal/start-ai", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Start AI failed");
      if (json.snapshot) setSnapshot(json.snapshot);
      const verdict = json.cycle?.verdict ?? m.lastVerdict ?? "—";
      const preview = json.cycle?.testnetPreviewId;
      setStartMessage(
        preview
          ? `AI cycle complete · verdict ${verdict} · testnet preview ready (double confirm required).`
          : json.cycle?.testnetConnected
            ? `AI cycle complete · verdict ${verdict}. Next: create testnet preview if TRADE.`
            : `AI cycle complete · verdict ${verdict}. Next: connect Binance Testnet.`,
      );
    } catch (e) {
      setStartMessage(e instanceof Error ? e.message : "Start AI failed");
    } finally {
      setStarting(false);
    }
  }, [m.lastVerdict, setSnapshot]);

  const hasData = m.totalTrades > 0 || Boolean(m.lastCycleAt);

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
              <Link href="/trades" className="mt-2 inline-block text-emerald-300 hover:underline">
                View trade →
              </Link>
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

      <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4 text-center">
        <p className="text-xs text-zinc-500">Recommended next step</p>
        <p className="mt-1 text-base font-semibold text-emerald-300">{m.nextRecommendation}</p>
      </section>

      <p className="text-center text-[10px] text-zinc-600">
        Practice money only. Live trading stays locked. Testnet orders require double confirmation.
      </p>
    </GoalShell>
  );
}
