"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GoalErrorBanner from "./GoalErrorBanner";
import GoalShell from "./GoalShell";
import TestnetTradeModal from "./TestnetTradeModal";
import type { GoalTradeRow } from "@/lib/goal-engine/build-trade-list";
import { useMissionSnapshot } from "./use-mission-snapshot";

type EnvFilter = "PRACTICE" | "ALL" | "PAPER" | "SHADOW" | "TESTNET" | "LIVE";

function usd(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function resultClass(result: GoalTradeRow["result"]): string {
  if (result === "WIN") return "text-emerald-300";
  if (result === "LOSS") return "text-rose-300";
  if (result === "OPEN") return "text-cyan-300";
  return "text-zinc-400";
}

function TradesTable({ trades, emptyLabel }: { trades: GoalTradeRow[]; emptyLabel: string }) {
  if (trades.length === 0) {
    return <p className="text-xs text-zinc-500">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-xs text-zinc-300">
        <thead>
          <tr className="text-zinc-500">
            <th className="pb-2 pr-3">Date</th>
            <th className="pb-2 pr-3">Env</th>
            <th className="pb-2 pr-3">Symbol</th>
            <th className="pb-2 pr-3">Side</th>
            <th className="pb-2 pr-3">PnL</th>
            <th className="pb-2 pr-3">Result</th>
            <th className="pb-2">Trade detail timeline</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={`${t.environment}-${t.id}`} className="border-t border-zinc-800/70">
              <td className="py-2 pr-3 text-zinc-400">
                {t.date ? new Date(t.date).toLocaleString() : "—"}
              </td>
              <td className="py-2 pr-3">{t.environment}</td>
              <td className="py-2 pr-3 text-zinc-200">{t.symbol}</td>
              <td className="py-2 pr-3">{t.side}</td>
              <td
                className={`py-2 pr-3 font-mono ${t.pnlUsd >= 0 ? "text-emerald-300" : "text-rose-300"}`}
              >
                {usd(t.pnlUsd)}
              </td>
              <td className={`py-2 pr-3 ${resultClass(t.result)}`}>{t.result}</td>
              <td className="py-2">
                <Link href={`/trades/${t.id}`} className="text-emerald-300 hover:underline">
                  View timeline →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TradesView() {
  const {
    snapshot: m,
    busy: missionBusy,
    error: missionError,
    degraded,
    warnings,
    refresh: refreshMission,
  } = useMissionSnapshot();
  const [trades, setTrades] = useState<GoalTradeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [env, setEnv] = useState<EnvFilter>("PRACTICE");
  const [closeModalOpen, setCloseModalOpen] = useState(false);

  const refreshTrades = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/goal-trades", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load trades");
      setTrades(json.trades as GoalTradeRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trades");
    } finally {
      setBusy(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([refreshMission(), refreshTrades()]);
  }, [refreshMission, refreshTrades]);

  useEffect(() => {
    void refreshTrades();
  }, [refreshTrades]);

  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (env === "PRACTICE" && t.environment === "LIVE") return false;
      if (env !== "ALL" && env !== "PRACTICE" && t.environment !== env) return false;
      return true;
    });
  }, [trades, env]);

  const openTrades = filtered.filter((t) => t.result === "OPEN");
  const closedTrades = filtered.filter((t) => t.result !== "OPEN");
  const useMissionTotals = env === "PRACTICE";
  const netPnl = useMissionTotals
    ? m.netPnl
    : closedTrades.reduce((s, t) => s + t.pnlUsd, 0);

  return (
    <GoalShell
      title="Trades"
      subtitle="Open and closed trades, PnL, and full lifecycle timelines."
      activePath="/trades"
      missionSnapshot={m}
      actions={
        <button
          type="button"
          disabled={busy || missionBusy}
          onClick={() => void refresh()}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-50"
        >
          {busy || missionBusy ? "Loading..." : "Refresh"}
        </button>
      }
    >
      <GoalErrorBanner
        error={error ?? missionError}
        degraded={degraded}
        warnings={warnings}
        snapshot={m}
      />

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">PnL</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
            <p className="text-[10px] uppercase text-zinc-500">Net PnL</p>
            <p
              className={`font-mono text-lg ${netPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}
            >
              {usd(netPnl)}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
            <p className="text-[10px] uppercase text-zinc-500">Open</p>
            <p className="font-mono text-lg text-cyan-300">
              {useMissionTotals ? m.openTrades : openTrades.length}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
            <p className="text-[10px] uppercase text-zinc-500">Closed</p>
            <p className="font-mono text-lg text-zinc-100">
              {useMissionTotals ? m.closedTrades : closedTrades.length}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
            <p className="text-[10px] uppercase text-zinc-500">Win / Loss</p>
            <p className="font-mono text-lg text-zinc-100">
              {useMissionTotals
                ? `${m.wins} / ${m.losses}`
                : `${closedTrades.filter((t) => t.result === "WIN").length} / ${closedTrades.filter((t) => t.result === "LOSS").length}`}
            </p>
          </div>
        </div>
      </section>

      {m.currentPosition?.canCloseOnTestnet && (
        <section className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
          <p className="text-xs text-zinc-400">Open testnet position</p>
          <p className="mt-1 font-mono text-sm text-zinc-100">{m.currentPosition.summary}</p>
          <button
            type="button"
            onClick={() => setCloseModalOpen(true)}
            className="mt-3 rounded-lg border border-amber-700/60 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-950/40"
          >
            Close position (double confirm)
          </button>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={env}
          onChange={(e) => setEnv(e.target.value as EnvFilter)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
        >
          <option value="PRACTICE">Practice (Paper + Testnet)</option>
          <option value="ALL">All environments</option>
          <option value="PAPER">Paper</option>
          <option value="SHADOW">Shadow</option>
          <option value="TESTNET">Testnet</option>
          <option value="LIVE">Live</option>
        </select>
      </div>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Open trades
        </h2>
        <div className="mt-3">
          <TradesTable trades={openTrades} emptyLabel="No open trades." />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Closed trades
        </h2>
        <div className="mt-3">
          <TradesTable
            trades={closedTrades}
            emptyLabel="No closed trades yet — run Start AI on Dashboard."
          />
        </div>
      </section>

      <TestnetTradeModal
        open={closeModalOpen}
        mode="close"
        position={m.currentPosition}
        onClose={() => setCloseModalOpen(false)}
        onSuccess={() => {
          setCloseModalOpen(false);
          void refresh();
        }}
      />
    </GoalShell>
  );
}
