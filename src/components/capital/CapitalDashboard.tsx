"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { buildCapitalReport } from "@/lib/capital/build-capital-report";
import {
  loadCapitalSettings,
  saveCapitalSettings,
} from "@/lib/capital/capital-settings";
import { MISSION_STAGE_FLOORS_USD } from "@/lib/capital/capital-mission-config";
import type { RiskOfRuinWarning } from "@/lib/capital/capital-types";

function ruinClass(level: RiskOfRuinWarning["level"]): string {
  const map: Record<RiskOfRuinWarning["level"], string> = {
    low: "text-emerald-400",
    moderate: "text-amber-300",
    high: "text-orange-400",
    critical: "text-rose-400",
  };
  return map[level];
}

export default function CapitalDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [settings, setSettings] = useState(loadCapitalSettings);

  const report = useMemo(() => {
    void refreshKey;
    return buildCapitalReport({
      entries: loadDecisionLog(),
      orders: loadPaperOrders(),
      riskProfile: loadDeskSettings().riskProfile,
      latestAnalysis: null,
      settings,
    });
  }, [refreshKey, settings]);

  const { stage, split, scalePermission, riskOfRuin } = report;
  const v = split.validationAllocation;

  const patchSettings = (patch: Parameters<typeof saveCapitalSettings>[0]) => {
    const next = saveCapitalSettings(patch);
    setSettings(next);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-3 py-4 sm:px-5">
      <header className="desk-panel flex flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div>
          <p className="desk-section-title text-violet-400/90">MVP 12</p>
          <h1 className="text-lg font-semibold text-zinc-50">
            Capital Scaling & Account Loop
          </h1>
          <p className="mt-1 max-w-xl text-xs text-zinc-500">
            $1k → $20k mission planner. Simulated equity from paper + decision log.
            No fund movement, no subaccounts, no live execution.
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
            href="/validation"
            className="rounded-lg border border-teal-900/50 px-3 py-1.5 text-xs text-teal-300/90 hover:bg-teal-950/40"
          >
            Validation
          </Link>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="rounded-lg bg-violet-800/80 px-3 py-1.5 text-xs font-medium text-zinc-100"
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title text-violet-300/90">Mission settings</h2>
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <label className="text-zinc-500">
            Start equity (USD)
            <input
              type="number"
              min={500}
              step={100}
              value={settings.missionStartUsd}
              onChange={(e) =>
                patchSettings({ missionStartUsd: Number(e.target.value) })
              }
              className="mt-1 block w-28 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-sm text-zinc-100"
            />
          </label>
          <label className="flex items-end gap-2 text-zinc-500">
            <input
              type="checkbox"
              checked={settings.useSimulatedEquity}
              onChange={(e) =>
                patchSettings({ useSimulatedEquity: e.target.checked })
              }
            />
            Auto equity from paper + log returns
          </label>
          {!settings.useSimulatedEquity && (
            <label className="text-zinc-500">
              Manual equity (USD)
              <input
                type="number"
                min={0}
                step={100}
                value={settings.manualEquityUsd}
                onChange={(e) =>
                  patchSettings({ manualEquityUsd: Number(e.target.value) })
                }
                className="mt-1 block w-32 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-sm text-zinc-100"
              />
            </label>
          )}
        </div>
        <p className="mt-2 font-mono text-[11px] text-zinc-600">
          Simulated return {report.simulatedReturnPct >= 0 ? "+" : ""}
          {report.simulatedReturnPct}% · equity ${stage.equityUsd.toLocaleString()}
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="desk-panel px-4 py-4 lg:col-span-1">
          <h2 className="desk-section-title">Current stage</h2>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">
            {stage.current.label}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Stage {stage.stageIndex + 1} of {stage.totalStages}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-violet-500/80 transition-all"
              style={{ width: `${stage.progressInStagePct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-zinc-600">
            {stage.progressInStagePct}% through this band
          </p>
          {stage.doubledSinceLastStage && (
            <p className="mt-2 text-xs text-amber-300">
              ✓ Equity ≥ 2× stage floor — split rebalance trigger active
            </p>
          )}
        </section>

        <section className="desk-panel px-4 py-4 lg:col-span-1">
          <h2 className="desk-section-title">Next milestone</h2>
          {stage.nextMilestone && stage.distanceToNextUsd != null ? (
            <>
              <p className="mt-2 text-xl font-semibold text-zinc-100">
                ${stage.nextMilestone.floorUsd.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                ${stage.distanceToNextUsd.toLocaleString()} to go
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-emerald-400/90">
              At or above mission cap band ($20k+)
            </p>
          )}
        </section>

        <section className="desk-panel px-4 py-4 lg:col-span-1">
          <h2 className="desk-section-title">Distance to goal</h2>
          <p className="mt-2 text-xl font-semibold text-zinc-100">
            ${stage.missionGoalUsd.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            ${stage.distanceToGoalUsd.toLocaleString()} remaining ·{" "}
            {stage.progressToGoalPct}% from ${stage.missionStartUsd.toLocaleString()}{" "}
            start
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-emerald-600/70"
              style={{ width: `${stage.progressToGoalPct}%` }}
            />
          </div>
        </section>
      </div>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title text-violet-300/90">
          Stage ladder · $1k → $20k
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {MISSION_STAGE_FLOORS_USD.map((floor, i) => (
            <li
              key={floor}
              className={`rounded px-2 py-1 font-mono text-[10px] ${
                i === stage.stageIndex
                  ? "bg-violet-900/50 text-violet-200 ring-1 ring-violet-600/50"
                  : stage.equityUsd >= floor
                    ? "bg-zinc-800 text-zinc-400"
                    : "bg-zinc-900 text-zinc-600"
              }`}
            >
              ${(floor / 1000).toFixed(0)}k
            </li>
          ))}
        </ul>
      </section>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title">Capital split recommendation</h2>
        <p className="mt-1 text-xs text-zinc-500">{split.trigger}</p>
        <p className="mt-1 text-[11px] text-zinc-600">{split.summary}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {split.buckets.map((b) => (
            <div
              key={b.key}
              className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-3"
            >
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                {b.label}
              </p>
              <p className="mt-1 font-mono text-lg text-zinc-100">{b.pct}%</p>
              <p className="font-mono text-xs text-violet-300/90">
                ${b.amountUsd.toLocaleString()}
              </p>
              <p className="mt-2 text-[10px] text-zinc-600">{b.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-zinc-600">
          MVP 10 blend: reserve {v.reservePct}% · core {v.coreStrategyPct}% · growth{" "}
          {v.growthStrategyPct}% · experimental {v.experimentalPct}%
        </p>
      </section>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title">Strategy allocation</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase text-zinc-500">Core sleeve</p>
            <ul className="mt-1 space-y-1 text-xs text-zinc-300">
              {v.coreStrategies.length ? (
                v.coreStrategies.map((id) => (
                  <li key={id} className="font-mono">
                    {id.replace(/_/g, " ")}
                  </li>
                ))
              ) : (
                <li className="text-zinc-600">None ACTIVE — keep in reserve</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase text-zinc-500">Growth sleeve</p>
            <ul className="mt-1 space-y-1 text-xs text-zinc-300">
              {v.growthStrategies.length ? (
                v.growthStrategies.map((id) => (
                  <li key={id} className="font-mono">
                    {id.replace(/_/g, " ")}
                  </li>
                ))
              ) : (
                <li className="text-zinc-600">Watchlist empty</li>
              )}
            </ul>
            <p className="mt-3 text-[10px] text-zinc-600">
              Aggressive mode:{" "}
              {v.aggressiveModeAllowed ? "permitted" : "blocked"} by validation
            </p>
          </div>
        </div>
      </section>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title">Scale permission</h2>
        <p
          className={`mt-2 text-sm font-medium ${
            scalePermission.allowed ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          Desk scaling: {scalePermission.allowed ? "ALLOWED (planning)" : "BLOCKED"}
        </p>
        {scalePermission.blockedReason && (
          <p className="mt-1 text-xs text-rose-300/90">
            {scalePermission.blockedReason}
          </p>
        )}
        <ul className="mt-3 space-y-1">
          {scalePermission.checks.map((c) => (
            <li
              key={c.id}
              className={`text-[11px] ${c.passed ? "text-emerald-400/90" : "text-rose-400/90"}`}
            >
              {c.passed ? "✓" : "✗"} {c.label} — {c.detail}
            </li>
          ))}
        </ul>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[11px]">
            <thead>
              <tr className="text-zinc-500">
                <th className="pb-2 pr-2">Strategy</th>
                <th className="pb-2 pr-2">Scale</th>
                <th className="pb-2">Block reason</th>
              </tr>
            </thead>
            <tbody>
              {scalePermission.strategyPermissions.map((s) => (
                <tr key={s.strategyId} className="border-t border-zinc-800/80">
                  <td className="py-2 pr-2 text-zinc-300">{s.label}</td>
                  <td
                    className={`py-2 pr-2 font-semibold ${
                      s.allowed ? "text-emerald-400" : "text-zinc-500"
                    }`}
                  >
                    {s.allowed ? "yes" : "no"}
                  </td>
                  <td className="py-2 text-zinc-600">{s.blockedReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className={`desk-panel border px-4 py-4 ${
          riskOfRuin.level === "critical" || riskOfRuin.level === "high"
            ? "border-rose-900/50"
            : "border-zinc-800"
        }`}
      >
        <h2 className={`desk-section-title ${ruinClass(riskOfRuin.level)}`}>
          Risk of ruin warning
        </h2>
        <p className={`mt-2 text-sm font-medium ${ruinClass(riskOfRuin.level)}`}>
          {riskOfRuin.headline} (score {riskOfRuin.score}/100)
        </p>
        <ul className="mt-2 list-inside list-disc text-xs text-zinc-500">
          {riskOfRuin.factors.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] text-zinc-600">{riskOfRuin.disclaimer}</p>
      </section>
    </div>
  );
}
