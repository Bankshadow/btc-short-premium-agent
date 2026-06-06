"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import type {
  StrategyHealthEnvironment,
  StrategyHealthRecommendation,
  StrategyHealthRow,
  StrategyHealthStatus,
  StrategyHealthSummary,
} from "@/lib/strategy-health";

const ENV_ORDER: StrategyHealthEnvironment[] = [
  "PAPER",
  "SHADOW",
  "TESTNET",
  "LIVE",
];

function statusClass(status: StrategyHealthStatus): string {
  const map: Record<StrategyHealthStatus, string> = {
    WATCHLIST: "text-amber-300 bg-amber-950/30 border-amber-900/50",
    ACTIVE_PAPER: "text-cyan-300 bg-cyan-950/30 border-cyan-900/50",
    ACTIVE_TESTNET: "text-emerald-300 bg-emerald-950/30 border-emerald-900/50",
    REVIEW_REQUIRED: "text-orange-300 bg-orange-950/30 border-orange-900/50",
    PAUSED: "text-rose-300 bg-rose-950/30 border-rose-900/50",
    CANDIDATE_FOR_LIVE: "text-violet-300 bg-violet-950/30 border-violet-900/50",
  };
  return `rounded border px-2 py-0.5 text-[10px] font-semibold ${map[status]}`;
}

function recommendationClass(rec: StrategyHealthRecommendation): string {
  if (rec === "pause strategy") return "text-rose-300";
  if (rec === "run risk replay" || rec === "reduce size") return "text-amber-300";
  if (rec === "promote to next stage") return "text-emerald-300";
  return "text-zinc-300";
}

function formatDuration(ms: number): string {
  if (!ms) return "—";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return `${h}h`;
}

export default function StrategyHealthDashboard() {
  const [summary, setSummary] = useState<StrategyHealthSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StrategyHealthStatus | "ALL">("ALL");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/strategy-health");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? res.statusText);
      setSummary(data.summary as StrategyHealthSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load strategy health");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo(() => {
    if (!summary) return [];
    if (statusFilter === "ALL") return summary.rows;
    return summary.rows.filter((r) => r.currentStatus === statusFilter);
  }, [summary, statusFilter]);

  return (
    <OpsShell
      badge="MVP 52 · Strategy Health"
      title="Strategy Health Dashboard"
      subtitle="Evaluate strategy quality across PAPER, SHADOW, TESTNET, and LIVE books to guide continue/pause/review decisions."
      accent="indigo"
      iconLetters="SH"
      activePath="/strategy-health"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/strategies", label: "Registry" },
        { href: "/validation", label: "Validation" },
        { href: "/execution-quality", label: "Execution quality" },
        { href: "/risk-replay", label: "Risk replay", primary: true },
      ]}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as StrategyHealthStatus | "ALL")
          }
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
        >
          <option value="ALL">All statuses</option>
          <option value="WATCHLIST">WATCHLIST</option>
          <option value="ACTIVE_PAPER">ACTIVE_PAPER</option>
          <option value="ACTIVE_TESTNET">ACTIVE_TESTNET</option>
          <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
          <option value="PAUSED">PAUSED</option>
          <option value="CANDIDATE_FOR_LIVE">CANDIDATE_FOR_LIVE</option>
        </select>
        <Link
          href="/live-readiness"
          className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-900/40"
        >
          Live readiness →
        </Link>
      </div>

      {error && (
        <p className="rounded border border-rose-900/50 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      {summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OpsKpi
              label="Strategies"
              value={String(summary.totals.strategies)}
              hint={`${summary.totals.reviewRequired} review · ${summary.totals.paused} paused`}
            />
            <OpsKpi
              label="Candidate for live"
              value={String(summary.totals.candidateForLive)}
              hint="Promotion-ready"
            />
            <OpsKpi
              label="Active testnet"
              value={String(summary.totals.activeTestnet)}
              hint="Validation stage"
            />
            <OpsKpi
              label="Watchlist"
              value={String(summary.totals.watchlist)}
              hint="Need more samples"
            />
          </div>

          <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Environment Totals
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ENV_ORDER.map((env) => {
                const v = summary.environmentTotals[env];
                return (
                  <div key={env} className="rounded border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                    <p className="text-[10px] text-zinc-500">{env}</p>
                    <p className="font-mono text-sm text-zinc-100">
                      n={v.sampleSize} · WR {v.winRate}%
                    </p>
                    <p className="font-mono text-[11px] text-zinc-400">
                      AvgR {v.averageR} · PnL {v.totalPnl}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Strategy Rows
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[1300px] text-left text-xs">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="pb-2 pr-3">Strategy</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Recommendation</th>
                    <th className="pb-2 pr-3">Sample</th>
                    <th className="pb-2 pr-3">Win</th>
                    <th className="pb-2 pr-3">Avg R</th>
                    <th className="pb-2 pr-3">PnL</th>
                    <th className="pb-2 pr-3">Max DD</th>
                    <th className="pb-2 pr-3">Avg Dur</th>
                    <th className="pb-2 pr-3">Exec Reliability</th>
                    <th className="pb-2 pr-3">False TRADE</th>
                    <th className="pb-2 pr-3">False SKIP</th>
                    <th className="pb-2 pr-3">Best / Worst Regime</th>
                    <th className="pb-2">Agreement</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: StrategyHealthRow) => (
                    <tr key={row.strategyId} className="border-t border-zinc-800/70">
                      <td className="py-2 pr-3 text-zinc-200">{row.strategyLabel}</td>
                      <td className="py-2 pr-3">
                        <span className={statusClass(row.currentStatus)}>{row.currentStatus}</span>
                      </td>
                      <td className={`py-2 pr-3 ${recommendationClass(row.recommendation)}`}>
                        {row.recommendation}
                      </td>
                      <td className="py-2 pr-3 font-mono text-zinc-300">{row.sampleSize}</td>
                      <td className="py-2 pr-3 font-mono text-zinc-300">{row.winRate}%</td>
                      <td className="py-2 pr-3 font-mono text-zinc-300">{row.averageR}</td>
                      <td className="py-2 pr-3 font-mono text-zinc-300">{row.totalPnl}</td>
                      <td className="py-2 pr-3 font-mono text-zinc-300">{row.maxDrawdown}</td>
                      <td className="py-2 pr-3 font-mono text-zinc-300">
                        {formatDuration(row.averageDurationMs)}
                      </td>
                      <td
                        className={`py-2 pr-3 font-mono ${row.executionWarning ? "text-amber-300" : "text-emerald-300"}`}
                      >
                        {row.executionReliabilityPct}%
                      </td>
                      <td className="py-2 pr-3 font-mono text-zinc-400">{row.falseTradeCount}</td>
                      <td className="py-2 pr-3 font-mono text-zinc-400">{row.falseSkipCount}</td>
                      <td className="py-2 pr-3 text-zinc-400">
                        {row.bestRegime} / {row.worstRegime}
                      </td>
                      <td className="py-2 text-zinc-300">
                        {row.agentAgreementQuality.label} ({row.agentAgreementQuality.scorePct}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Environment Split Per Strategy
            </h2>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {rows.map((row) => (
                <article key={`${row.strategyId}-env`} className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
                  <p className="text-xs font-semibold text-zinc-200">{row.strategyLabel}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {ENV_ORDER.map((env) => {
                      const m = row.environmentMetrics[env];
                      return (
                        <div key={env} className="rounded border border-zinc-800 px-2 py-2 text-[11px]">
                          <p className="text-zinc-500">{env}</p>
                          <p className="font-mono text-zinc-300">
                            n={m.sampleSize} · WR {m.winRate}% · AvgR {m.averageR}
                          </p>
                          <p className="font-mono text-zinc-500">
                            PnL {m.totalPnl} · DD {m.maxDrawdown}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </OpsShell>
  );
}
