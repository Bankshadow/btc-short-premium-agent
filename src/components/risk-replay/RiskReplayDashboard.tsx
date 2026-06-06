"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import type {
  RiskReplayReport,
  RiskReplayScenarioResult,
  RiskReplayTradeOption,
} from "@/lib/risk-replay";

function usd(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

function pct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function pnlClass(n: number): string {
  if (n > 0) return "text-emerald-300";
  if (n < 0) return "text-rose-300";
  return "text-zinc-400";
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ScenarioTable({
  actual,
  simulated,
}: {
  actual: RiskReplayScenarioResult;
  simulated: RiskReplayScenarioResult[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-xs text-zinc-300">
        <thead>
          <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wide text-zinc-500">
            <th className="py-2 pr-2">Scenario</th>
            <th className="py-2 pr-2">Entry</th>
            <th className="py-2 pr-2">Exit</th>
            <th className="py-2 pr-2">PnL</th>
            <th className="py-2 pr-2">PnL %</th>
            <th className="py-2 pr-2">Avoided loss</th>
            <th className="py-2 pr-2">Missed profit</th>
            <th className="py-2">Note</th>
          </tr>
        </thead>
        <tbody>
          {[actual, ...simulated].map((row) => (
            <tr
              key={row.scenarioId}
              className={`border-b border-zinc-900/70 ${row.simulated ? "" : "bg-zinc-900/30"}`}
            >
              <td className="py-2 pr-2">
                {row.label}
                {!row.simulated && (
                  <span className="ml-2 rounded border border-zinc-700 px-1 py-0.5 text-[10px] text-zinc-400">
                    actual
                  </span>
                )}
              </td>
              <td className="py-2 pr-2 font-mono">{row.entryPrice.toFixed(2)}</td>
              <td className="py-2 pr-2 font-mono">{row.exitPrice.toFixed(2)}</td>
              <td className={`py-2 pr-2 font-mono ${pnlClass(row.pnlUsd)}`}>{usd(row.pnlUsd)}</td>
              <td className={`py-2 pr-2 font-mono ${pnlClass(row.pnlUsd)}`}>{pct(row.pnlPct)}</td>
              <td className="py-2 pr-2 font-mono text-amber-300">{usd(row.avoidedLoss)}</td>
              <td className="py-2 pr-2 font-mono text-cyan-300">{usd(row.missedProfit)}</td>
              <td className="py-2 text-zinc-500">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RiskReplayDashboard({
  initialTradeId,
}: {
  initialTradeId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<RiskReplayTradeOption[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string>(initialTradeId ?? "");
  const [report, setReport] = useState<RiskReplayReport | null>(null);

  const loadTrades = useCallback(async () => {
    const res = await fetch("/api/risk-replay/trades", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? "Failed loading replay trades");
    }
    const list = (data.trades ?? []) as RiskReplayTradeOption[];
    setTrades(list);
    if (!selectedTradeId && list.length > 0) {
      setSelectedTradeId(initialTradeId && list.some((t) => t.tradeId === initialTradeId) ? initialTradeId : list[0]!.tradeId);
    }
  }, [initialTradeId, selectedTradeId]);

  const runReplay = useCallback(async () => {
    if (!selectedTradeId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/risk-replay/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId: selectedTradeId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Risk replay failed");
      }
      setReport(data.report as RiskReplayReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Risk replay failed");
      setReport(null);
    } finally {
      setBusy(false);
    }
  }, [selectedTradeId]);

  useEffect(() => {
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await loadTrades();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed loading trades");
      } finally {
        setBusy(false);
      }
    })();
  }, [loadTrades]);

  useEffect(() => {
    if (initialTradeId) {
      setSelectedTradeId(initialTradeId);
    }
  }, [initialTradeId]);

  const selectedMeta = useMemo(
    () => trades.find((t) => t.tradeId === selectedTradeId) ?? null,
    [trades, selectedTradeId],
  );

  return (
    <OpsShell
      badge="MVP 50 · Simulation only"
      title="Risk Replay & What-If Simulator"
      subtitle="Replay closed PAPER/TESTNET trades under alternative sizing and exit rules. No live execution impact."
      accent="rose"
      iconLetters="RR"
      activePath="/risk-replay"
      nav={[
        { href: "/trades/" + encodeURIComponent(selectedTradeId || "unknown"), label: "Trade detail" },
        { href: "/testnet-monitor", label: "Testnet monitor" },
        { href: "/portfolio", label: "Portfolio" },
        { href: "/learning", label: "Learning" },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTradeId}
            onChange={(e) => setSelectedTradeId(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
          >
            <option value="">Select closed trade</option>
            {trades.map((trade) => (
              <option key={trade.tradeId} value={trade.tradeId}>
                [{trade.environment}] {trade.symbol} · {trade.tradeId.slice(0, 12)} · {usd(trade.actualPnlUsd)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !selectedTradeId}
            onClick={() => void runReplay()}
            className="rounded border border-rose-800/50 bg-rose-950/40 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/40 disabled:opacity-50"
          >
            {busy ? "Running..." : "Run What-If"}
          </button>
        </div>
      }
    >
      <p className="mb-4 rounded border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
        Simulation only. Cannot alter actual trade history. Cannot increase live risk automatically.
      </p>

      {error && (
        <p className="mb-4 rounded border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi
          label="Selected trade"
          value={selectedMeta ? selectedMeta.tradeId.slice(0, 12) : "—"}
          hint={selectedMeta ? `${selectedMeta.environment} ${selectedMeta.symbol}` : "Pick a closed trade"}
        />
        <OpsKpi
          label="Actual result"
          value={report ? usd(report.actualResult.pnlUsd) : "—"}
          hint={report ? pct(report.actualResult.pnlPct) : undefined}
        />
        <OpsKpi
          label="Avoided loss"
          value={report ? usd(report.avoidedLoss) : "—"}
          hint="Potential downside prevented"
        />
        <OpsKpi
          label="Missed profit"
          value={report ? usd(report.missedProfit) : "—"}
          hint="Opportunity left on table"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Replay summary">
          {!report ? (
            <p className="text-xs text-zinc-500">
              Select a closed trade and run replay to compare actual outcome vs what-if scenarios.
            </p>
          ) : (
            <div className="space-y-2 text-xs text-zinc-300">
              <p>
                Trade <span className="font-mono">{report.trade.tradeId}</span> · {report.trade.environment} ·{" "}
                {report.trade.symbol}
              </p>
              <p>
                Decision: {report.trade.originalDecision.finalVerdict ?? "—"} · confidence{" "}
                {report.trade.originalDecision.confidence != null
                  ? `${Math.round(report.trade.originalDecision.confidence * 100)}%`
                  : "—"}
              </p>
              <p>
                Original stop/take-profit:{" "}
                {report.trade.originalStopTakeProfit.stopLoss != null
                  ? report.trade.originalStopTakeProfit.stopLoss.toFixed(2)
                  : "—"}
                {" / "}
                {report.trade.originalStopTakeProfit.takeProfit != null
                  ? report.trade.originalStopTakeProfit.takeProfit.toFixed(2)
                  : "—"}
              </p>
              <p>
                Actual entry/exit: {report.trade.entryPrice.toFixed(2)} /{" "}
                {report.trade.exitPrice.toFixed(2)}
              </p>
              <p>
                Recommended rule change:{" "}
                <span className="text-cyan-300">{report.recommendedRuleChange}</span>
              </p>
              <p>
                Confidence: <span className="text-emerald-300">{report.confidence}%</span>
              </p>
              <p className="text-amber-300">{report.riskNote}</p>
            </div>
          )}
        </Panel>

        <Panel title="Price path">
          {!report ? (
            <p className="text-xs text-zinc-500">Market path shown when replay is loaded.</p>
          ) : (
            <div>
              <p className="mb-2 text-xs text-zinc-500">
                {report.trade.marketPricePath.length} points · synthetic fallback used when full path unavailable.
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-[11px] text-zinc-400">
                {report.trade.marketPricePath.map((point) => (
                  <li key={`${point.timestamp}-${point.price}`}>
                    {new Date(point.timestamp).toLocaleString()} · {point.price.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="What-if scenarios">
        {!report ? (
          <p className="text-xs text-zinc-500">No simulation result yet.</p>
        ) : (
          <ScenarioTable actual={report.actualResult} simulated={report.simulatedResults} />
        )}
      </Panel>
    </OpsShell>
  );
}
