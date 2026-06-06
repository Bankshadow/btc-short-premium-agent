"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GoalShell from "./GoalShell";
import type { GoalTradeRow } from "@/lib/goal-engine/build-trade-list";
import type { MissionSnapshot } from "@/lib/goal-engine/types";
import { emptyMissionSnapshot } from "@/lib/goal-engine/build-mission-snapshot";

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
  const [trades, setTrades] = useState<GoalTradeRow[]>([]);
  const [mission, setMission] = useState<MissionSnapshot>(emptyMissionSnapshot());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [env, setEnv] = useState<EnvFilter>("PRACTICE");
  const [state, setState] = useState<StateFilter>("ALL");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [tradesRes, dashRes] = await Promise.all([
        fetch("/api/goal-trades", { cache: "no-store" }),
        fetch("/api/goal-dashboard", { cache: "no-store" }),
      ]);
      const tradesJson = await tradesRes.json();
      const dashJson = await dashRes.json();
      if (!tradesRes.ok || !tradesJson.ok) {
        throw new Error(tradesJson.error ?? "Failed to load trades");
      }
      setTrades(tradesJson.trades as GoalTradeRow[]);
      if (dashRes.ok && dashJson.ok && dashJson.mission) {
        setMission(dashJson.mission as MissionSnapshot);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trades");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
  const totalTrades = useMissionTotals ? mission.totalTrades : filtered.filter((t) => t.result !== "OPEN").length;
  const openCount = filtered.filter((t) => t.result === "OPEN").length;
  const closedCount = useMissionTotals
    ? mission.totalTrades
    : filtered.filter((t) => t.result !== "OPEN").length;
  const wins = useMissionTotals ? mission.winTrades : filtered.filter((t) => t.result === "WIN").length;
  const losses = useMissionTotals ? mission.lossTrades : filtered.filter((t) => t.result === "LOSS").length;
  const netPnl = useMissionTotals ? mission.netPnl : filtered.reduce((s, t) => s + t.pnlUsd, 0);

  return (
    <GoalShell
      title="Trades"
      subtitle="Every trade the AI has taken, across practice and testnet. Live trades are labeled separately."
      activePath="/trades"
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
        Summary matches dashboard when filtered to practice (Paper + Testnet). Live is always separate.
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Total closed</p>
          <p className="font-mono text-lg text-zinc-100">{totalTrades}</p>
        </div>
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Open / Closed</p>
          <p className="font-mono text-lg text-zinc-100">
            {openCount} / {closedCount}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Win / Loss</p>
          <p className="font-mono text-lg text-zinc-100">
            {wins} / {losses}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] uppercase text-zinc-500">Net PnL</p>
          <p className={`font-mono text-lg ${netPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {usd(netPnl)}
          </p>
        </div>
      </div>

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
        <span className="text-xs text-zinc-500">
          {filtered.length} rows · {wins}W / {losses}L · net{" "}
          <span className={netPnl >= 0 ? "text-emerald-300" : "text-rose-300"}>{usd(netPnl)}</span>
        </span>
      </div>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        {filtered.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No trades recorded yet. Run your first AI cycle or connect Binance Testnet.
          </p>
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
                      <Link
                        href={`/trades/${t.id}`}
                        className="text-emerald-300 hover:underline"
                      >
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
    </GoalShell>
  );
}
