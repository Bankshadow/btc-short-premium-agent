"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { DEFAULT_QUANT_FRICTION } from "@/lib/quant-backtest/friction";
import type {
  QuantBacktestSymbol,
  QuantBacktestTimeframe,
} from "@/lib/quant-backtest/types";
import type {
  TournamentClassification,
  TournamentEntry,
  TournamentResult,
} from "@/lib/strategy-tournament/types";
import { TOURNAMENT_SAFETY_NOTICE } from "@/lib/strategy-tournament/types";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function classBadge(c: TournamentClassification): string {
  const map: Record<TournamentClassification, string> = {
    CANDIDATE_TESTNET: "text-emerald-300 bg-emerald-950/30 border-emerald-900/50",
    FILTER_ONLY: "text-indigo-300 bg-indigo-950/30 border-indigo-900/50",
    REJECT: "text-rose-300 bg-rose-950/30 border-rose-900/50",
    NEEDS_MORE_DATA: "text-amber-300 bg-amber-950/30 border-amber-900/50",
  };
  return `rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${map[c]}`;
}

export default function StrategyTournamentDashboard() {
  const [symbol, setSymbol] = useState<QuantBacktestSymbol>("BTCUSDT");
  const [timeframe, setTimeframe] = useState<QuantBacktestTimeframe>("4h");
  const [startDate, setStartDate] = useState("2024-06-01");
  const [endDate, setEndDate] = useState("2025-06-01");
  const [result, setResult] = useState<TournamentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runTournament = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    setResult(null);
    try {
      const res = await fetch("/api/strategy-tournament/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          timeframe,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          friction: DEFAULT_QUANT_FRICTION,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? res.statusText);
      setResult(data.result as TournamentResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tournament failed");
    } finally {
      setBusy(false);
    }
  }, [symbol, timeframe, startDate, endDate]);

  const promoteWinner = async (entry: TournamentEntry) => {
    if (entry.classification !== "CANDIDATE_TESTNET") return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/strategy-tournament/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: entry.sourceId,
          humanApproval: true,
          operatorNote: `Tournament #${entry.rank} winner → paper review`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? data.message);
      setMessage(data.message as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promote failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OpsShell
      badge="MVP 68 · Tournament"
      title="Strategy Tournament"
      subtitle="Run MACD, RSI, Bollinger, Dual Thrust, Heikin-Ashi, and AI Desk on the same BTC/SOL dataset — ranked by AI."
      accent="amber"
      iconLetters="ST"
      activePath="/strategy-lab/tournament"
      nav={[
        { href: "/strategy-garage", label: "Garage", primary: true },
        { href: "/strategy-lab/imports", label: "Imports" },
        { href: "/strategy-lab/backtest", label: "Backtest" },
        { href: "/strategy-lab/tournament", label: "Tournament" },
        { href: "/strategy-lab/shadow", label: "Shadow" },
        { href: "/strategies", label: "Registry" },
        { href: "/", label: "← Desk" },
      ]}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void runTournament()}
          className="rounded-lg bg-amber-700/90 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-600 disabled:opacity-50"
        >
          {busy ? "Running..." : "Run tournament"}
        </button>
      }
    >
      <div className="mb-4 rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-xs text-rose-200/90">
        {TOURNAMENT_SAFETY_NOTICE}
      </div>

      {error && <p className="mb-3 text-xs text-rose-300">{error}</p>}
      {message && <p className="mb-3 text-xs text-emerald-300">{message}</p>}

      <Panel title="Dataset (shared by all strategies)">
        <div className="grid gap-3 sm:grid-cols-4 text-xs text-zinc-400">
          <label>
            Symbol
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value as QuantBacktestSymbol)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100"
            >
              <option value="BTCUSDT">BTCUSDT</option>
              <option value="SOLUSDT">SOLUSDT</option>
            </select>
          </label>
          <label>
            Timeframe
            <select
              value={timeframe}
              onChange={(e) =>
                setTimeframe(e.target.value as QuantBacktestTimeframe)
              }
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100"
            >
              <option value="1h">1H</option>
              <option value="4h">4H</option>
              <option value="1d">1D</option>
            </select>
          </label>
          <label>
            Start
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-zinc-100"
            />
          </label>
          <label>
            End
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-zinc-100"
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">
          All six strategies use identical klines plus fees ({DEFAULT_QUANT_FRICTION.feeBps}bps) ·
          slippage ({DEFAULT_QUANT_FRICTION.slippageBps}bps) · spread ({DEFAULT_QUANT_FRICTION.spreadBps}bps).
        </p>
      </Panel>

      {result && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <OpsKpi label="Bars" value={String(result.barsLoaded)} />
            <OpsKpi
              label="Winner"
              value={result.winner?.strategyName?.split(" ")[0] ?? "—"}
            />
            <OpsKpi
              label="Top score"
              value={String(result.winner?.ranking.compositeScore ?? "—")}
            />
            <OpsKpi
              label="Candidates"
              value={String(
                result.entries.filter((e) => e.classification === "CANDIDATE_TESTNET")
                  .length,
              )}
            />
          </div>

          {result.winner && (
            <Panel title="Tournament winner">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold text-amber-200">
                  #{result.winner.rank} {result.winner.strategyName}
                </span>
                <span className={classBadge(result.winner.classification)}>
                  {result.winner.classification.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-300">
                {result.winner.classificationSummary}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Return {result.winner.metrics.totalReturnPct}% · PF{" "}
                {result.winner.metrics.profitFactor} · WR{" "}
                {result.winner.metrics.winRate}% · DD{" "}
                {result.winner.metrics.maxDrawdownPct}%
              </p>
              {result.winner.classification === "CANDIDATE_TESTNET" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void promoteWinner(result.winner!)}
                  className="mt-3 rounded-lg bg-emerald-700/90 px-3 py-2 text-xs font-semibold text-zinc-50 hover:bg-emerald-600 disabled:opacity-50"
                >
                  Promote winner to paper review
                </button>
              )}
            </Panel>
          )}

          <Panel title="AI rankings">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-400">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="py-1 pr-3">#</th>
                    <th className="py-1 pr-3">Strategy</th>
                    <th className="py-1 pr-3">Score</th>
                    <th className="py-1 pr-3">Return</th>
                    <th className="py-1 pr-3">DD</th>
                    <th className="py-1 pr-3">WR</th>
                    <th className="py-1 pr-3">PF</th>
                    <th className="py-1 pr-3">Trades/100</th>
                    <th className="py-1 pr-3">AI class</th>
                  </tr>
                </thead>
                <tbody>
                  {result.entries.map((entry) => (
                    <TournamentRow key={entry.sourceId} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </OpsShell>
  );
}

function TournamentRow({ entry }: { entry: TournamentEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className="cursor-pointer border-t border-zinc-800/80 hover:bg-zinc-900/40"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="py-2 pr-3 font-mono text-amber-300">{entry.rank}</td>
        <td className="py-2 pr-3 text-zinc-200">{entry.strategyName}</td>
        <td className="py-2 pr-3 font-mono">{entry.ranking.compositeScore}</td>
        <td className="py-2 pr-3">{entry.metrics.totalReturnPct}%</td>
        <td className="py-2 pr-3">{entry.metrics.maxDrawdownPct}%</td>
        <td className="py-2 pr-3">{entry.metrics.winRate}%</td>
        <td className="py-2 pr-3">{entry.metrics.profitFactor}</td>
        <td className="py-2 pr-3">{entry.tradeFrequencyPer100Bars}</td>
        <td className="py-2 pr-3">
          <span className={classBadge(entry.classification)}>
            {entry.classification.replace(/_/g, " ")}
          </span>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-zinc-800/50 bg-zinc-950/80">
          <td colSpan={9} className="px-3 py-3 text-[11px] text-zinc-500">
            <p className="text-zinc-300">{entry.classificationSummary}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <span>Stability: {entry.ranking.stabilityScore}</span>
              <span>Simplicity: {entry.ranking.simplicityScore}</span>
              <span>Exec risk: {entry.ranking.executionRiskScore}</span>
              <span>Freq score: {entry.ranking.tradeFrequencyScore}</span>
            </div>
            {entry.rejectionReasons.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-rose-300/90">
                {entry.rejectionReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            <Link
              href={`/strategy-lab/backtest?importId=${encodeURIComponent(entry.sourceId)}`}
              className="mt-2 inline-block text-amber-300 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Deep-dive backtest →
            </Link>
          </td>
        </tr>
      )}
    </>
  );
}
