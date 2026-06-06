"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import DeskEmptyState from "@/components/desk/DeskEmptyState";
import DataHealthPanel from "@/components/data-backbone/DataHealthPanel";
import { loadDeskBackboneInputs } from "@/lib/data-backbone/read-desk-state";
import { buildValidationReport } from "@/lib/validation/build-validation-report";
import {
  loadKillSwitchState,
  saveKillSwitchState,
} from "@/lib/validation/kill-switch";
import type { StrategyStatus } from "@/lib/validation/validation-types";
import { REGIME_ROUTER_RULES } from "@/lib/validation/regime-router";

function statusClass(status: StrategyStatus): string {
  const map: Record<StrategyStatus, string> = {
    ACTIVE: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
    WATCHLIST: "bg-amber-500/20 text-amber-200 ring-amber-500/30",
    PAPER_ONLY: "bg-sky-500/20 text-sky-200 ring-sky-500/30",
    DISABLED: "bg-rose-500/20 text-rose-300 ring-rose-500/30",
    EXPERIMENTAL: "bg-zinc-500/20 text-zinc-300 ring-zinc-500/30",
  };
  return `inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${map[status]}`;
}

export default function ValidationDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [pauseReason, setPauseReason] = useState("");

  const { record, productionEntries, productionOrders, riskProfile } = useMemo(() => {
    void refreshKey;
    const input = loadDeskBackboneInputs();
    return {
      record: input.record,
      productionEntries: input.productionEntries,
      productionOrders: input.productionOrders,
      riskProfile: input.riskProfile,
    };
  }, [refreshKey]);

  const report = useMemo(
    () =>
      buildValidationReport({
        entries: productionEntries,
        orders: productionOrders,
        riskProfile,
        latestAnalysis: null,
      }),
    [productionEntries, productionOrders, riskProfile],
  );

  const toggleOperatorPause = () => {
    const state = loadKillSwitchState();
    if (state.operatorPaused) {
      saveKillSwitchState({
        operatorPaused: false,
        operatorPauseReason: "",
        operatorPausedAt: null,
      });
    } else {
      saveKillSwitchState({
        operatorPaused: true,
        operatorPauseReason: pauseReason.trim() || "Manual operator pause",
        operatorPausedAt: new Date().toISOString(),
        cooldownUntil: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
    }
    setRefreshKey((k) => k + 1);
  };

  const resolvedCount = record.learning.resolvedOutcomesCount;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-3 py-4 sm:px-5">
      <DataHealthPanel health={record.health} compact />

      {resolvedCount === 0 && (
        <DeskEmptyState
          title="Validation needs outcomes"
          missing="No resolved production outcomes yet."
          why="Strategy promotion and kill-switch logic require resolved paper outcomes — demo seed data does not count."
          actionLabel="Run desk cycle on cockpit"
          actionHref="/"
        />
      )}
      <header className="desk-panel flex flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div>
          <p className="desk-section-title text-teal-400/90">MVP 10</p>
          <h1 className="text-lg font-semibold text-zinc-50">
            Profit Validation & Capital Control
          </h1>
          <p className="mt-1 max-w-xl text-xs text-zinc-500">
            Measurement only — no new strategies, no live orders. Uses decision
            log + paper book to promote/demote edge.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            ← Trading desk
          </Link>
          <Link
            href="/capital"
            className="rounded-lg border border-violet-900/50 px-3 py-1.5 text-xs text-violet-300/90 hover:bg-violet-950/40"
          >
            Capital
          </Link>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="rounded-lg bg-teal-800/80 px-3 py-1.5 text-xs font-medium text-zinc-100"
          >
            Refresh report
          </button>
        </div>
      </header>

      <section className="desk-panel border-rose-900/40 px-4 py-4">
        <h2 className="desk-section-title text-rose-400/90">Kill switch & cooldown</h2>
        <div className="mt-2 flex flex-wrap gap-4 text-xs">
          <span className={report.killSwitch.tradingPaused ? "text-rose-400" : "text-emerald-400"}>
            Trading paused: {report.killSwitch.tradingPaused ? "YES" : "no"}
          </span>
          <span>
            Aggressive blocked: {report.killSwitch.aggressiveBlocked ? "yes" : "no"}
          </span>
          <span>Daily PnL: {report.killSwitch.dailyPnlPct}%</span>
          <span>Weekly PnL: {report.killSwitch.weeklyPnlPct}%</span>
          <span>Drawdown: {report.killSwitch.peakToTroughDrawdownPct}%</span>
          <span>Loss streak: {report.killSwitch.consecutiveLosses}</span>
        </div>
        {report.killSwitch.cooldownUntil && (
          <p className="mt-2 text-xs text-amber-400">
            Cooldown until{" "}
            {new Date(report.killSwitch.cooldownUntil).toLocaleString("th-TH")}
          </p>
        )}
        <ul className="mt-2 list-inside list-disc text-[11px] text-zinc-500">
          {report.killSwitch.messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            type="text"
            placeholder="Operator pause reason"
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
          />
          <button
            type="button"
            onClick={toggleOperatorPause}
            className="rounded bg-rose-900/60 px-3 py-1 text-xs text-zinc-100"
          >
            {loadKillSwitchState().operatorPaused
              ? "Clear operator pause"
              : "Operator pause (24h)"}
          </button>
        </div>
      </section>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title">Capital allocation v2</h2>
        <p className="mt-1 text-sm text-zinc-300">{report.capitalAllocation.summary}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          {[
            ["Reserve", report.capitalAllocation.reservePct],
            ["Core", report.capitalAllocation.coreStrategyPct],
            ["Growth", report.capitalAllocation.growthStrategyPct],
            ["Experimental", report.capitalAllocation.experimentalPct],
          ].map(([label, pct]) => (
            <div key={label as string} className="rounded-lg bg-zinc-950/80 px-3 py-2">
              <p className="text-[10px] text-zinc-500">{label}</p>
              <p className="font-mono text-xl text-zinc-100">{pct}%</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Regime: {report.currentRegimeLabel} · Risk profile: {report.riskProfile}
        </p>
      </section>

      <section className="desk-panel overflow-x-auto px-4 py-4">
        <h2 className="desk-section-title">Strategy performance matrix</h2>
        <table className="mt-3 w-full min-w-[900px] text-left text-[11px]">
          <thead className="text-zinc-500">
            <tr>
              <th className="pb-2 pr-2">Strategy</th>
              <th className="pb-2 pr-2">Status</th>
              <th className="pb-2 pr-2">Signals</th>
              <th className="pb-2 pr-2">Win%</th>
              <th className="pb-2 pr-2">Avg R</th>
              <th className="pb-2 pr-2">PF</th>
              <th className="pb-2 pr-2">Max DD</th>
              <th className="pb-2 pr-2">FP/FN</th>
              <th className="pb-2 pr-2">Skips✓</th>
              <th className="pb-2">Best / Worst regime</th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {report.strategyMatrix.map((row) => (
              <tr key={row.id} className="border-t border-zinc-800/80">
                <td className="py-2 pr-2 font-medium">{row.label}</td>
                <td className="py-2 pr-2">
                  <span className={statusClass(row.status)}>{row.status}</span>
                </td>
                <td className="py-2 pr-2 font-mono">
                  {row.totalSignals}
                  <span className="text-zinc-600"> / {row.resolvedSignals} res</span>
                </td>
                <td className="py-2 pr-2 font-mono">{row.winRate}%</td>
                <td className="py-2 pr-2 font-mono">{row.averageR}</td>
                <td className="py-2 pr-2 font-mono">{row.profitFactor}</td>
                <td className="py-2 pr-2 font-mono">{row.maxDrawdownPct}%</td>
                <td className="py-2 pr-2 font-mono">
                  {row.falsePositives}/{row.falseNegatives}
                </td>
                <td className="py-2 pr-2 font-mono">{row.correctSkips}</td>
                <td className="py-2 text-zinc-500">
                  {row.bestRegime} · {row.worstRegime}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[10px] text-zinc-600">{report.strategyMatrix[0]?.promotionReason}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="desk-panel px-4 py-4">
          <h2 className="desk-section-title">Agent status board</h2>
          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {report.agentBoard.map((a) => (
              <li
                key={a.agentName}
                className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    {a.agentName}
                  </span>
                  <span className={statusClass(a.status)}>{a.status}</span>
                </div>
                <p className="mt-1 text-[10px] text-zinc-500">
                  {a.totalCalls} calls · {a.winRate}% · avg R {a.averageR} · DD{" "}
                  {a.maxDrawdownPct}%
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="desk-panel px-4 py-4">
          <h2 className="desk-section-title">Regime performance & router</h2>
          <ul className="mt-3 space-y-2">
            {report.regimePerformance.map((r) => (
              <li
                key={r.regime}
                className="rounded-lg border border-zinc-800 px-3 py-2 text-[11px]"
              >
                <p className="font-medium text-zinc-200">{r.label}</p>
                <p className="text-zinc-500">
                  {r.sessions} sessions · {r.winRate}% win · net {r.netPnlPct}%
                </p>
                <p className="mt-1 text-teal-600/80">{r.routerNote}</p>
              </li>
            ))}
          </ul>
          <details className="mt-3 text-[10px] text-zinc-500">
            <summary className="cursor-pointer">Static router rules</summary>
            <ul className="mt-2 space-y-1">
              {REGIME_ROUTER_RULES.map((rule) => (
                <li key={rule.regime}>
                  {rule.label}: {rule.blocked ? "NO TRADE" : rule.allowed.join(", ")}
                </li>
              ))}
            </ul>
          </details>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="desk-panel border-rose-900/30 px-4 py-4">
          <h2 className="desk-section-title text-rose-400/80">What to disable next</h2>
          <ul className="mt-2 space-y-2">
            {report.disableNext.length === 0 ? (
              <li className="text-xs text-zinc-600">Nothing flagged.</li>
            ) : (
              report.disableNext.map((item) => (
                <li key={item.target} className="text-xs text-zinc-400">
                  <strong className="text-zinc-200">{item.target}</strong> — {item.reason}
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="desk-panel border-emerald-900/30 px-4 py-4">
          <h2 className="desk-section-title text-emerald-400/80">What to scale next</h2>
          <ul className="mt-2 space-y-2">
            {report.scaleNext.length === 0 ? (
              <li className="text-xs text-zinc-600">No ACTIVE strategies in current regime.</li>
            ) : (
              report.scaleNext.map((item) => (
                <li key={item.target} className="text-xs text-zinc-400">
                  <strong className="text-zinc-200">{item.target}</strong> — {item.reason}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title">Recent operator overrides</h2>
        {report.recentOverrides.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-600">None logged.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {report.recentOverrides.map((o) => (
              <li key={o.logEntryId} className="text-xs text-zinc-400">
                {new Date(o.createdAt).toLocaleString("th-TH")} · expected {o.verdict} — {o.reason}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-[10px] text-zinc-600">
        Generated {new Date(report.generatedAt).toLocaleString("th-TH")} · Analysis only
      </p>
    </div>
  );
}
