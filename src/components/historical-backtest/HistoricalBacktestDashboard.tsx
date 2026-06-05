"use client";

import { useCallback, useEffect, useState } from "react";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import {
  buildRegistryPayloadForAnalyze,
  buildStrategyRegistry,
} from "@/lib/strategy-registry/build-strategy-registry";
import { buildGovernancePayloadForAnalyze } from "@/lib/governance/build-governance-payload";
import { buildAdaptiveWeightingPayload } from "@/lib/adaptive-agent-weighting/build-payload";
import type {
  BacktestCompareResult,
  BacktestResult,
  BacktestScenario,
} from "@/lib/historical-backtest/types";
import { HISTORICAL_BACKTEST_SAFETY_NOTICE } from "@/lib/historical-backtest/types";

const BACKTEST_HISTORY_KEY = "btc-desk:backtest-history";

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

function loadLocalHistory(): BacktestResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BACKTEST_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as BacktestResult[]) : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(results: BacktestResult[]): void {
  localStorage.setItem(BACKTEST_HISTORY_KEY, JSON.stringify(results.slice(0, 20)));
}

function defaultScenario(versionTag: string, label: string): BacktestScenario {
  const settings = loadDeskSettings();
  const entries = loadDecisionLog();
  const orders = loadPaperOrders();
  const registrySnapshot = buildStrategyRegistry({
    entries,
    orders,
    riskProfile: settings.riskProfile,
  });
  const registry = buildRegistryPayloadForAnalyze(registrySnapshot);
  const governance = buildGovernancePayloadForAnalyze({
    entries,
    orders,
    riskProfile: settings.riskProfile,
  });
  const adaptiveWeighting = buildAdaptiveWeightingPayload({ entries });

  return {
    id: `scenario-${versionTag}`,
    label,
    versionTag,
    maxSessions: 30,
    riskProfile: settings.riskProfile,
    strategyRegistry: registry,
    governance,
    adaptiveWeighting,
    enableAdaptiveWeighting: adaptiveWeighting.settings.adaptiveWeightingEnabled,
  };
}

export default function HistoricalBacktestDashboard() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [compare, setCompare] = useState<BacktestCompareResult | null>(null);
  const [history, setHistory] = useState<BacktestResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"run" | "compare">("run");
  const [maxSessions, setMaxSessions] = useState(30);
  const [enableAdaptive, setEnableAdaptive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadLocalHistory());
  }, []);

  const runBacktest = useCallback(async () => {
    setBusy(true);
    setError(null);
    setCompare(null);
    try {
      const scenario = {
        ...defaultScenario("current", "Current rules"),
        maxSessions,
        enableAdaptiveWeighting: enableAdaptive,
      };
      const res = await fetch("/api/backtest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          entries: loadDecisionLog(),
          orders: loadPaperOrders(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      const next = data.result as BacktestResult;
      setResult(next);
      const updated = [next, ...loadLocalHistory()].slice(0, 20);
      saveLocalHistory(updated);
      setHistory(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backtest failed");
    } finally {
      setBusy(false);
    }
  }, [maxSessions, enableAdaptive]);

  const runCompare = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const baseline = {
        ...defaultScenario("current", "Current rules"),
        maxSessions,
        enableAdaptiveWeighting: enableAdaptive,
      };
      const proposed = {
        ...defaultScenario("proposed", "Proposed tightening"),
        maxSessions,
        enableAdaptiveWeighting: enableAdaptive,
        proposedRuleTightening: true,
      };
      const res = await fetch("/api/backtest/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseline,
          proposed,
          entries: loadDecisionLog(),
          orders: loadPaperOrders(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      const next = data.compare as BacktestCompareResult;
      setCompare(next);
      setResult(next.baseline);
      const updated = [
        next.baseline,
        next.proposed,
        ...loadLocalHistory(),
      ].slice(0, 20);
      saveLocalHistory(updated);
      setHistory(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compare failed");
    } finally {
      setBusy(false);
    }
  }, [maxSessions, enableAdaptive]);

  const metrics = result?.metrics;
  const cmp = compare?.comparison;

  return (
    <OpsShell
      badge="Backtest"
      title="Historical Backtest Engine"
      subtitle="Replay decision log sessions through playbook, registry, risk, committee, regime brain, and adaptive weighting — simulation only."
      accent="violet"
      iconLetters="BT"
      activePath="/backtest"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void (mode === "compare" ? runCompare() : runBacktest())}
            className="rounded-lg border border-violet-800 bg-violet-950/40 px-4 py-2 text-sm font-medium text-violet-100 hover:bg-violet-900/40 disabled:opacity-50"
          >
            {busy ? "Running…" : mode === "compare" ? "Compare versions" : "Run backtest"}
          </button>
        </div>
      }
    >
      <p className="mb-4 text-xs text-zinc-500">{HISTORICAL_BACKTEST_SAFETY_NOTICE}</p>
      {error && (
        <p className="mb-4 rounded border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <Panel title="Create backtest scenario">
          <div className="space-y-3 text-sm text-zinc-300">
            <label className="flex items-center justify-between gap-4">
              <span>Mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "run" | "compare")}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              >
                <option value="run">Single run (current rules)</option>
                <option value="compare">Compare current vs proposed</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-4">
              <span>Max sessions</span>
              <input
                type="number"
                min={5}
                max={100}
                value={maxSessions}
                onChange={(e) => setMaxSessions(Number(e.target.value))}
                className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={enableAdaptive}
                onChange={(e) => setEnableAdaptive(e.target.checked)}
              />
              Include adaptive agent weighting (simulation mode)
            </label>
            <p className="text-xs text-zinc-500">
              Replays: BTC trend · IV/HV · funding · OI · liquidation proxy · macro flags ·
              options candidates · full desk pipeline.
            </p>
          </div>
        </Panel>

        <Panel title="Backtest results">
          {metrics ? (
            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
              <p>Return: <span className="text-violet-200">{metrics.totalReturnPct}%</span></p>
              <p>Max DD: <span className="text-rose-300">{metrics.maxDrawdownPct}%</span></p>
              <p>Win rate: {metrics.winRate}%</p>
              <p>Expectancy: {metrics.expectancy}%</p>
              <p>Avg win: {metrics.averageWinPct}%</p>
              <p>Avg loss: {metrics.averageLossPct}%</p>
              <p>Trades: {metrics.tradeFrequency}</p>
              <p>Alignment: {metrics.alignmentRate}%</p>
              <p>False TRADE: {metrics.falseTradeCount}</p>
              <p>False SKIP: {metrics.falseSkipCount}</p>
              <p>Missed opp: {metrics.missedOpportunityCount}</p>
              <p>Loss streak: {metrics.longestLossStreak}</p>
              <p className="col-span-2 text-zinc-500">
                Risk veto blocked {metrics.riskVetoImpact.tradesBlocked} trades · saved{" "}
                {metrics.riskVetoImpact.pnlSavedPct}% PnL
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Run a backtest to see metrics.</p>
          )}
        </Panel>
      </div>

      {cmp && (
        <Panel title="Strategy version comparison">
          <div className="mb-4 text-xs text-zinc-400">
            <p>
              {cmp.baselineVersion} vs {cmp.proposedVersion} · Δ return{" "}
              <span className={cmp.deltaReturnPct >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {cmp.deltaReturnPct >= 0 ? "+" : ""}
                {cmp.deltaReturnPct}%
              </span>{" "}
              · Δ win rate {cmp.deltaWinRate >= 0 ? "+" : ""}
              {cmp.deltaWinRate}pp · Δ false TRADE {cmp.deltaFalseTrade}
            </p>
            <p className="mt-2 text-violet-200">{cmp.recommendation}</p>
          </div>
        </Panel>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi label="Total return" value={metrics ? `${metrics.totalReturnPct}%` : "—"} />
        <OpsKpi label="Win rate" value={metrics ? `${metrics.winRate}%` : "—"} />
        <OpsKpi label="Sessions" value={String(metrics?.sessionsReplayed ?? "—")} />
        <OpsKpi
          label="False TRADE"
          value={String(metrics?.falseTradeCount ?? "—")}
          hint="Simulation only"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Equity curve">
          {result?.equityCurve.length ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-[11px] text-zinc-500">
              {result.equityCurve.map((p) => (
                <li key={p.timestamp}>
                  {new Date(p.timestamp).toLocaleString()} · equity {p.equityPct}% · DD{" "}
                  {p.drawdownPct}%
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No simulated trades yet.</p>
          )}
        </Panel>

        <Panel title="Trade list">
          {result?.trades.length ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-400">
              {result.trades.slice(0, 15).map((t) => (
                <li key={t.logId}>
                  {t.loggedVerdict} → {t.simulatedVerdict}
                  {t.simulatedRiskVeto ? " (veto)" : ""} · {t.primaryRegime} ·{" "}
                  {t.pnlPct != null ? `${t.pnlPct}%` : "—"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">—</p>
          )}
        </Panel>

        <Panel title="Rule impact">
          {result?.ruleImpact.length ? (
            <ul className="space-y-1 text-xs text-zinc-400">
              {result.ruleImpact.map((r) => (
                <li key={r.ruleId}>
                  {r.label}: {r.triggerCount} triggers · {r.tradesAffected} trades · Δ{" "}
                  {r.estimatedPnlDeltaPct}%
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No rule triggers in replay.</p>
          )}
        </Panel>

        <Panel title="Regime breakdown">
          {result?.regimeBreakdown.length ? (
            <ul className="space-y-1 text-xs text-zinc-400">
              {result.regimeBreakdown.map((r) => (
                <li key={r.regime}>
                  {r.label}: {r.sessions} sessions · {r.simulatedTrades} trades ·{" "}
                  {r.winRate}% win · net {r.netPnlPct}%
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">—</p>
          )}
        </Panel>
      </div>

      {history.length > 0 && (
        <div className="mt-4">
          <Panel title="Recent runs (local)">
            <ul className="space-y-1 text-xs text-zinc-500">
              {history.slice(0, 5).map((h) => (
                <li key={h.run.id}>
                  {h.run.versionTag} · {h.metrics.sessionsReplayed} sessions · return{" "}
                  {h.metrics.totalReturnPct}% · {new Date(h.run.completedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </OpsShell>
  );
}
