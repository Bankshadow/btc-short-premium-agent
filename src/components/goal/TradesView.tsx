"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GoalErrorBanner from "./GoalErrorBanner";
import GoalShell from "./GoalShell";
import TestnetTradeModal from "./TestnetTradeModal";
import type { GoalTradeRow } from "@/lib/goal-engine/build-trade-list";
import { useMissionSnapshot } from "./use-mission-snapshot";

type EnvFilter = "PRACTICE" | "ALL" | "PAPER" | "SHADOW" | "TESTNET" | "LIVE";
type StateFilter = "ALL" | "OPEN" | "CLOSED";

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
  const [state, setState] = useState<StateFilter>("ALL");
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
      if (state === "OPEN" && t.result !== "OPEN") return false;
      if (state === "CLOSED" && t.result === "OPEN") return false;
      return true;
    });
  }, [trades, env, state]);

  const useMissionTotals = env === "PRACTICE" && state === "ALL";
  const emptyNextAction =
    m.binanceTestnet.status !== "CONNECTED"
      ? "Connect Binance Testnet"
      : "Run first AI cycle";

  return (
    <GoalShell
      title="Trades"
      subtitle="Every trade the AI has taken, across practice and testnet. Live trades are labeled separately."
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

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Total closed</p>
          <p className="font-mono text-lg text-zinc-100">
            {useMissionTotals ? m.closedTrades : filtered.filter((t) => t.result !== "OPEN").length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Open / Closed</p>
          <p className="font-mono text-lg text-zinc-100">
            {useMissionTotals ? m.openTrades : filtered.filter((t) => t.result === "OPEN").length} /{" "}
            {useMissionTotals ? m.closedTrades : filtered.filter((t) => t.result !== "OPEN").length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Win / Loss</p>
          <p className="font-mono text-lg text-zinc-100">
            {useMissionTotals ? `${m.wins} / ${m.losses}` : `${filtered.filter((t) => t.result === "WIN").length} / ${filtered.filter((t) => t.result === "LOSS").length}`}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Net PnL</p>
          <p className={`font-mono text-lg ${(useMissionTotals ? m.netPnl : filtered.reduce((s, t) => s + t.pnlUsd, 0)) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {usd(useMissionTotals ? m.netPnl : filtered.reduce((s, t) => s + t.pnlUsd, 0))}
          </p>
        </div>
      </div>

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

      {m.pendingTestnetPreview && !m.pendingTestnetPreview.blocked && (
        <section className="rounded-xl border border-cyan-900/40 bg-cyan-950/20 p-4">
          <p className="text-xs text-zinc-400">Pending testnet preview</p>
          <p className="mt-1 font-mono text-sm text-zinc-100">
            {m.pendingTestnetPreview.symbol} {m.pendingTestnetPreview.side} · $
            {m.pendingTestnetPreview.notionalUsd}
          </p>
          <Link href="/" className="mt-2 inline-block text-xs text-cyan-300 hover:underline">
            Review on Dashboard →
          </Link>
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
        <select
          value={state}
          onChange={(e) => setState(e.target.value as StateFilter)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
        >
          <option value="ALL">Open + closed</option>
          <option value="OPEN">Open only</option>
          <option value="CLOSED">Closed only</option>
        </select>
      </div>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        {filtered.length === 0 ? (
          <div className="text-xs text-zinc-500">
            <p>No trades recorded yet.</p>
            <p className="mt-2 text-amber-300/90">Next: {emptyNextAction}</p>
            {m.binanceTestnet.status !== "CONNECTED" ? (
              <Link href="/binance-testnet" className="mt-2 inline-block text-emerald-300 hover:underline">
                Connect Binance Testnet →
              </Link>
            ) : (
              <Link href="/" className="mt-2 inline-block text-emerald-300 hover:underline">
                Run first AI cycle →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs text-zinc-300">
              <thead>
                <tr className="text-zinc-500">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Env</th>
                  <th className="pb-2 pr-3">Symbol</th>
                  <th className="pb-2 pr-3">Side</th>
                  <th className="pb-2 pr-3">PnL</th>
                  <th className="pb-2 pr-3">Result</th>
                  <th className="pb-2">Lifecycle</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={`${t.environment}-${t.id}`} className="border-t border-zinc-800/70">
                    <td className="py-2 pr-3 text-zinc-400">
                      {t.date ? new Date(t.date).toLocaleString() : "—"}
                    </td>
                    <td className="py-2 pr-3">{t.environment}</td>
                    <td className="py-2 pr-3 text-zinc-200">{t.symbol}</td>
                    <td className="py-2 pr-3">{t.side}</td>
                    <td className={`py-2 pr-3 font-mono ${t.pnlUsd >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {usd(t.pnlUsd)}
                    </td>
                    <td className={`py-2 pr-3 ${resultClass(t.result)}`}>{t.result}</td>
                    <td className="py-2">
                      <Link href={`/trades/${t.id}`} className="text-emerald-300 hover:underline">
                        View full lifecycle →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
