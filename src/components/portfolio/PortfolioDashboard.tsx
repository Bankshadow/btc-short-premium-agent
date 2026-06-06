"use client";

import Link from "next/link";
import { useState } from "react";
import OpsShell from "@/components/ops/OpsShell";
import DeskEmptyState from "@/components/desk/DeskEmptyState";
import DataHealthPanel from "@/components/data-backbone/DataHealthPanel";
import { useDeskBackbone } from "@/hooks/useDeskBackbone";
import { useUnifiedPortfolio } from "@/hooks/useUnifiedPortfolio";
import type { PaperMode } from "@/lib/paper/paper-relaxed-types";
import type {
  ExposureSlice,
  PnlSlice,
  UnifiedPaperPosition,
  UnifiedPortfolioMetrics,
} from "@/lib/portfolio/unified-types";

function fmtUsd(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function pnlClass(n: number): string {
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-rose-400";
  return "text-zinc-400";
}

function MetricCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 font-mono text-lg font-semibold ${valueClass ?? "text-zinc-100"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function PortfolioSummaryPanel({ m }: { m: UnifiedPortfolioMetrics }) {
  return (
    <section className="desk-panel px-5 py-4">
      <h2 className="text-sm font-semibold text-zinc-100">Portfolio Summary</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Unified paper book — BTC options + perp directional (no live orders).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total equity" value={fmtUsd(m.totalEquity)} sub={`Base ${fmtUsd(m.baseEquityUsd)}`} />
        <MetricCard
          label="Total PnL"
          value={fmtUsd(m.totalPnlUsd)}
          sub={fmtPct(m.totalPnlPct)}
          valueClass={pnlClass(m.totalPnlUsd)}
        />
        <MetricCard
          label="Realized PnL"
          value={fmtUsd(m.realizedPnlUsd)}
          sub={fmtPct(m.realizedPnlPct)}
          valueClass={pnlClass(m.realizedPnlUsd)}
        />
        <MetricCard
          label="Unrealized PnL"
          value={fmtUsd(m.unrealizedPnlUsd)}
          sub={fmtPct(m.unrealizedPnlPct)}
          valueClass={pnlClass(m.unrealizedPnlUsd)}
        />
        <MetricCard label="Open exposure" value={fmtUsd(m.openExposureUsd)} sub={`${m.openExposurePct}% of base`} />
        <MetricCard label="Win rate" value={`${m.winRate}%`} sub={`${m.winCount}W / ${m.lossCount}L`} />
        <MetricCard label="Daily PnL" value={fmtUsd(m.dailyPnlUsd)} valueClass={pnlClass(m.dailyPnlUsd)} />
        <MetricCard label="Weekly PnL" value={fmtUsd(m.weeklyPnlUsd)} valueClass={pnlClass(m.weeklyPnlUsd)} />
      </div>
    </section>
  );
}

function PositionsTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: UnifiedPaperPosition[];
  empty: string;
}) {
  return (
    <section className="desk-panel overflow-hidden px-5 py-4">
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">{empty}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="py-2 pr-3">Book</th>
                <th className="py-2 pr-3">Symbol</th>
                <th className="py-2 pr-3">Strategy</th>
                <th className="py-2 pr-3">Agent</th>
                <th className="py-2 pr-3">Log</th>
                <th className="py-2 pr-3">Notional</th>
                <th className="py-2 pr-3">PnL</th>
                <th className="py-2">Opened</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-900/80 text-zinc-300">
                  <td className="py-2 pr-3 font-mono text-[10px]">
                    {row.book === "btc_options" ? "OPT" : "PERP"}
                    {row.paperMode === "RELAXED_PAPER" && (
                      <span className="ml-1 text-amber-400">R</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-semibold">{row.symbol}</td>
                  <td className="py-2 pr-3">{row.strategyName}</td>
                  <td className="py-2 pr-3 text-zinc-400">{row.sourceAgent}</td>
                  <td className="py-2 pr-3">
                    <Link
                      href="/"
                      className="font-mono text-[10px] text-cyan-400/90 hover:underline"
                      title={row.decisionLogId}
                    >
                      {row.decisionLogId.slice(0, 14)}…
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{fmtUsd(row.notionalUsd)}</td>
                  <td className={`py-2 pr-3 font-mono ${pnlClass(
                    row.status === "OPEN" ? row.unrealizedPnlUsd : row.realizedPnlUsd,
                  )}`}>
                    {row.status === "OPEN"
                      ? fmtUsd(row.unrealizedPnlUsd)
                      : fmtUsd(row.realizedPnlUsd)}
                  </td>
                  <td className="py-2 font-mono text-[10px] text-zinc-500">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ExposureBars({
  title,
  slices,
}: {
  title: string;
  slices: ExposureSlice[];
}) {
  const max = Math.max(...slices.map((s) => s.notionalUsd), 1);
  return (
    <section className="desk-panel px-5 py-4">
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      {slices.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">No data yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {slices.map((slice) => {
            const pct = (slice.notionalUsd / max) * 100;
            return (
              <li key={slice.key}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-zinc-300">{slice.key}</span>
                  <span className="font-mono text-zinc-400">
                    {fmtUsd(slice.notionalUsd)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className="h-full rounded-full bg-teal-500/80"
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PnlBars({ title, slices }: { title: string; slices: PnlSlice[] }) {
  const max = Math.max(...slices.map((s) => s.totalUsd), 1);
  return (
    <section className="desk-panel px-5 py-4">
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      {slices.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">No data yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {slices.map((slice) => {
            const pct = (Math.abs(slice.totalUsd) / max) * 100;
            return (
              <li key={slice.key}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-zinc-300">{slice.key}</span>
                  <span className={`font-mono ${pnlClass(slice.totalUsd)}`}>
                    {fmtUsd(slice.totalUsd)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className="h-full rounded-full bg-teal-500/80"
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DrawdownMonitor({
  m,
  curve,
}: {
  m: UnifiedPortfolioMetrics;
  curve: { at: string; equityUsd: number }[];
}) {
  return (
    <section className="desk-panel px-5 py-4">
      <h2 className="text-sm font-semibold text-zinc-100">Drawdown Monitor</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Max drawdown"
          value={fmtPct(-m.maxDrawdownPct)}
          sub={fmtUsd(-m.maxDrawdownUsd)}
          valueClass="text-rose-400"
        />
        <MetricCard label="Avg win" value={fmtPct(m.averageWinPct)} valueClass="text-emerald-400" />
        <MetricCard label="Avg loss" value={fmtPct(m.averageLossPct)} valueClass="text-rose-400" />
      </div>
      {curve.length > 1 && (
        <div className="mt-4 flex h-16 items-end gap-0.5">
          {curve.map((point, i) => {
            const min = Math.min(...curve.map((p) => p.equityUsd));
            const max = Math.max(...curve.map((p) => p.equityUsd));
            const range = max - min || 1;
            const h = ((point.equityUsd - min) / range) * 100;
            return (
              <div
                key={`${point.at}-${i}`}
                className="min-w-[3px] flex-1 rounded-t bg-teal-600/70"
                style={{ height: `${Math.max(8, h)}%` }}
                title={`${new Date(point.at).toLocaleString()} · ${fmtUsd(point.equityUsd)}`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

type PaperModeFilter = "ALL" | PaperMode;

export default function PortfolioDashboard() {
  const { snapshot, hydrated, syncing, error, refresh, syncToServer } =
    useUnifiedPortfolio();
  const backbone = useDeskBackbone();
  const [modeFilter, setModeFilter] = useState<PaperModeFilter>("ALL");

  const m = snapshot?.metrics;
  const filterByMode = (rows: UnifiedPaperPosition[]) => {
    if (modeFilter === "ALL") return rows;
    return rows.filter((r) => (r.paperMode ?? "STRICT_PAPER") === modeFilter);
  };
  const open = filterByMode(snapshot?.openPositions ?? []);
  const closed = filterByMode(snapshot?.closedTrades ?? []);

  return (
    <OpsShell
      badge="MVP 22 · Paper only"
      title="Unified Paper Portfolio"
      subtitle="BTC options paper + multi-asset perp paper in one book. Every row traces to decision log metadata — no live execution."
      accent="teal"
      iconLetters="PF"
      activePath="/portfolio"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/assets", label: "Perp scanner", primary: true },
        { href: "/automation", label: "Automation" },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as PaperModeFilter)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-200"
          >
            <option value="ALL">All paper modes</option>
            <option value="STRICT_PAPER">Strict paper</option>
            <option value="RELAXED_PAPER">Relaxed paper</option>
          </select>
          <button
            type="button"
            onClick={() => refresh()}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={syncing}
            onClick={() => void syncToServer()}
            className="rounded-lg bg-teal-700/90 px-4 py-2 text-xs font-semibold text-zinc-100 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync to server"}
          </button>
        </div>
      }
    >
      <DataHealthPanel health={backbone.health} compact />
      {backbone.learning && (
        <p className="text-xs text-zinc-500">
          Backbone sample size {backbone.learning.strategySampleSize} · paper PnL{" "}
          {backbone.portfolio?.paperPnlPct ?? 0}% — shared across cockpit, validation, and
          capital.
        </p>
      )}

      {!hydrated && (
        <p className="text-sm text-zinc-500">Loading unified portfolio…</p>
      )}
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {snapshot?.migrationApplied && (
        <p className="rounded-lg border border-teal-900/40 bg-teal-950/20 px-4 py-2 text-xs text-teal-200/80">
          Perp metadata migration applied — trace fields added without removing existing positions.
        </p>
      )}

      {hydrated &&
        (snapshot?.openPositions?.length ?? 0) + (snapshot?.closedTrades?.length ?? 0) ===
          0 && (
          <DeskEmptyState
            title="Portfolio empty"
            missing="No paper or shadow trades in the book yet."
            why="Portfolio reads from linked paper/shadow orders — run a desk cycle and enable auto-create settings."
            actionLabel="Run desk cycle"
            actionHref="/"
          />
        )}

      {m && (
        <>
          <PortfolioSummaryPanel m={m} />
          <div className="grid gap-4 lg:grid-cols-2">
            <PnlBars title="PnL by Asset" slices={snapshot.pnlByAsset} />
            <PnlBars title="PnL by Strategy" slices={snapshot.pnlByStrategy} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ExposureBars title="Risk Exposure by Asset" slices={m.exposureByAsset} />
            <ExposureBars title="Risk Exposure by Strategy" slices={m.exposureByStrategy} />
          </div>
          <DrawdownMonitor m={m} curve={snapshot.equityCurve} />
          <PositionsTable
            title="Open Positions"
            rows={open}
            empty="No open paper positions — run analyze or perp scan to open paper trades."
          />
          <PositionsTable
            title="Closed Trades"
            rows={closed}
            empty="No closed paper trades yet."
          />
        </>
      )}
    </OpsShell>
  );
}
