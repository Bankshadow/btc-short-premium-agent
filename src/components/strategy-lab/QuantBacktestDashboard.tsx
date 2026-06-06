"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { DEFAULT_QUANT_FRICTION } from "@/lib/quant-backtest/friction";
import { isQuantBacktestRunnerSupported } from "@/lib/quant-backtest/signal-runners";
import type {
  QuantBacktestResult,
  QuantBacktestSymbol,
  QuantBacktestTimeframe,
} from "@/lib/quant-backtest/types";
import { QUANT_BACKTEST_SAFETY_NOTICE } from "@/lib/quant-backtest/types";
import type { ImportedStrategyCard } from "@/lib/quant-strategy-importer/types";

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

function verdictClass(verdict: string): string {
  const map: Record<string, string> = {
    PAPER_WORTHY: "text-emerald-300",
    BACKTEST_MORE: "text-amber-300",
    REJECT: "text-rose-300",
    INSUFFICIENT_DATA: "text-zinc-400",
  };
  return map[verdict] ?? "text-zinc-300";
}

const RUNNABLE = [
  "macd-oscillator",
  "rsi-pattern-recognition",
  "bollinger-bands-pattern",
  "dual-thrust",
  "heikin-ashi",
];

export default function QuantBacktestDashboard() {
  const searchParams = useSearchParams();
  const importIdFromUrl = searchParams.get("importId");

  const [strategies, setStrategies] = useState<ImportedStrategyCard[]>([]);
  const [sourceId, setSourceId] = useState(importIdFromUrl ?? "macd-oscillator");
  const [symbol, setSymbol] = useState<QuantBacktestSymbol>("BTCUSDT");
  const [timeframe, setTimeframe] = useState<QuantBacktestTimeframe>("4h");
  const [startDate, setStartDate] = useState("2024-06-01");
  const [endDate, setEndDate] = useState("2025-06-01");
  const [feeBps, setFeeBps] = useState(DEFAULT_QUANT_FRICTION.feeBps);
  const [slippageBps, setSlippageBps] = useState(DEFAULT_QUANT_FRICTION.slippageBps);
  const [spreadBps, setSpreadBps] = useState(DEFAULT_QUANT_FRICTION.spreadBps);
  const [result, setResult] = useState<QuantBacktestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/quant-strategy-importer")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && json.catalog?.strategies) {
          setStrategies(json.catalog.strategies as ImportedStrategyCard[]);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (importIdFromUrl) setSourceId(importIdFromUrl);
  }, [importIdFromUrl]);

  const selected = useMemo(
    () => strategies.find((s) => s.sourceId === sourceId) ?? null,
    [strategies, sourceId],
  );

  const runnable = isQuantBacktestRunnerSupported(sourceId);

  const runBacktest = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/quant-backtest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId,
          symbol,
          timeframe,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          friction: { feeBps, slippageBps, spreadBps },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? res.statusText);
      setResult(data.result as QuantBacktestResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backtest failed");
    } finally {
      setBusy(false);
    }
  }, [sourceId, symbol, timeframe, startDate, endDate, feeBps, slippageBps, spreadBps]);

  return (
    <OpsShell
      badge="MVP 67 · Backtest only"
      title="Quant Strategy Backtest"
      subtitle="Historical BTC/SOL replay with fees, slippage, and spread — no orders created."
      accent="indigo"
      iconLetters="QB"
      activePath="/strategy-lab/backtest"
      nav={[
        { href: "/strategy-garage", label: "Garage", primary: true },
        { href: "/strategy-lab/imports", label: "Imports" },
        { href: "/strategy-lab/backtest", label: "Backtest" },
        { href: "/strategy-lab/tournament", label: "Tournament" },
        { href: "/strategy-lab/shadow", label: "Shadow" },
        { href: "/backtest", label: "Desk replay" },
        { href: "/experiments", label: "Experiments" },
        { href: "/", label: "← Desk" },
      ]}
      actions={
        <button
          type="button"
          disabled={busy || !runnable}
          onClick={() => void runBacktest()}
          className="rounded-lg bg-indigo-700/90 px-3 py-2 text-xs font-semibold text-zinc-50 hover:bg-indigo-600 disabled:opacity-50"
        >
          {busy ? "Running..." : "Run backtest"}
        </button>
      }
    >
      <div className="mb-4 rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-xs text-rose-200/90">
        {QUANT_BACKTEST_SAFETY_NOTICE}
      </div>

      {error && <p className="mb-3 text-xs text-rose-300">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title="Backtest inputs">
          <div className="space-y-3 text-xs text-zinc-400">
            <label className="block">
              Imported strategy
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100"
              >
                {strategies.length === 0 &&
                  RUNNABLE.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                {strategies.map((s) => (
                  <option key={s.sourceId} value={s.sourceId}>
                    {s.strategyName}
                    {!isQuantBacktestRunnerSupported(s.sourceId) ? " (no runner)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-zinc-100"
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-zinc-100"
                />
              </label>
            </div>
            <div>
              <p className="mb-2 font-semibold text-zinc-300">Friction assumptions</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  Fee (bps/side)
                  <input
                    type="number"
                    value={feeBps}
                    onChange={(e) => setFeeBps(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-zinc-100"
                  />
                </label>
                <label>
                  Slippage (bps/side)
                  <input
                    type="number"
                    value={slippageBps}
                    onChange={(e) => setSlippageBps(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-zinc-100"
                  />
                </label>
                <label>
                  Spread (bps entry)
                  <input
                    type="number"
                    value={spreadBps}
                    onChange={(e) => setSpreadBps(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-zinc-100"
                  />
                </label>
              </div>
              <p className="mt-2 text-[11px] text-zinc-600">
                Unlike frictionless source-repo backtests, every trade includes round-trip costs.
              </p>
            </div>
            {!runnable && (
              <p className="text-amber-300">
                This import has no kline runner yet — pick MACD, RSI, Bollinger, Dual Thrust, or Heikin-Ashi.
              </p>
            )}
            {selected && (
              <p className="text-[11px] text-zinc-500">{selected.thesis}</p>
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          {result ? (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <OpsKpi
                  label="Return"
                  value={`${result.metrics.totalReturnPct}%`}
                />
                <OpsKpi label="Win rate" value={`${result.metrics.winRate}%`} />
                <OpsKpi
                  label="Max DD"
                  value={`${result.metrics.maxDrawdownPct}%`}
                />
                <OpsKpi label="Trades" value={String(result.metrics.tradeCount)} />
              </div>

              <Panel title="AI recommendation">
                <p
                  className={`text-sm font-semibold ${verdictClass(result.aiRecommendation.verdict)}`}
                >
                  {result.aiRecommendation.verdict.replace(/_/g, " ")}
                </p>
                <p className="mt-2 text-xs text-zinc-300">
                  {result.aiRecommendation.summary}
                </p>
                <ul className="mt-2 list-inside list-disc text-[11px] text-zinc-500">
                  {result.aiRecommendation.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-rose-300/80">
                  Paper/testnet still requires human approval — backtest cannot auto-promote.
                </p>
                {result.aiRecommendation.verdict === "PAPER_WORTHY" && (
                  <Link
                    href="/strategy-lab/imports"
                    className="mt-3 inline-block text-xs text-emerald-300 hover:underline"
                  >
                    Return to imports to manually mark ready for paper →
                  </Link>
                )}
              </Panel>

              <Panel title="Metrics (after friction)">
                <ul className="grid gap-1 text-xs text-zinc-400 sm:grid-cols-2">
                  <li>Profit factor: {result.metrics.profitFactor}</li>
                  <li>Avg win: {result.metrics.averageWinPct}%</li>
                  <li>Avg loss: {result.metrics.averageLossPct}%</li>
                  <li>Expectancy: {result.metrics.expectancyPct}%</li>
                  <li>Friction total: {result.frictionTotalPct}%</li>
                  <li>Bars loaded: {result.barsLoaded}</li>
                </ul>
              </Panel>

              <Panel title="Liquidity warning">
                <p
                  className={
                    result.liquidityWarning.level === "OK"
                      ? "text-emerald-300 text-xs"
                      : "text-amber-300 text-xs"
                  }
                >
                  [{result.liquidityWarning.level}] {result.liquidityWarning.message}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Avg bar volume: {result.liquidityWarning.avgBarVolume}
                </p>
              </Panel>

              <Panel title="Regime breakdown">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-400">
                    <thead>
                      <tr className="text-zinc-500">
                        <th className="py-1 pr-3">Regime</th>
                        <th className="py-1 pr-3">Trades</th>
                        <th className="py-1 pr-3">Win%</th>
                        <th className="py-1">Net%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.regimeBreakdown.map((row) => (
                        <tr key={row.regime} className="border-t border-zinc-800/80">
                          <td className="py-1 pr-3 capitalize">{row.regime}</td>
                          <td className="py-1 pr-3">{row.tradeCount}</td>
                          <td className="py-1 pr-3">{row.winRate}%</td>
                          <td className="py-1">{row.netReturnPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Equity curve">
                {result.equityCurve.length === 0 ? (
                  <p className="text-xs text-zinc-500">No closed trades in window.</p>
                ) : (
                  <div className="flex h-24 items-end gap-0.5">
                    {result.equityCurve.map((point) => {
                      const h = Math.max(4, Math.min(100, 50 + point.equityPct * 2));
                      return (
                        <div
                          key={point.timestamp}
                          title={`${point.timestamp}: ${point.equityPct}%`}
                          className="flex-1 rounded-t bg-indigo-600/70"
                          style={{ height: `${h}%` }}
                        />
                      );
                    })}
                  </div>
                )}
              </Panel>
            </>
          ) : (
            <Panel title="Results">
              <p className="text-xs text-zinc-500">
                Configure inputs and run a backtest. Results include fees, slippage, spread, and an AI paper-worthiness summary.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </OpsShell>
  );
}
