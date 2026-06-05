"use client";

import { useCallback, useEffect, useState } from "react";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { buildGovernancePayloadForAnalyze } from "@/lib/governance/build-governance-payload";
import type { RiskBudgetResult } from "@/lib/risk-budget-optimizer/types";
import { RISK_BUDGET_SAFETY_NOTICE } from "@/lib/risk-budget-optimizer/types";
import {
  loadClientRiskBudget,
  saveClientRiskBudget,
} from "@/lib/risk-budget-optimizer/client-store";

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

export default function RiskBudgetDashboard() {
  const [budget, setBudget] = useState<RiskBudgetResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const entries = loadDecisionLog();
      const orders = loadPaperOrders();
      const riskProfile = loadDeskSettings().riskProfile;
      const res = await fetch("/api/risk-budget/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries,
          orders,
          perpPositions: loadPerpPositions(),
          riskProfile,
          governance: buildGovernancePayloadForAnalyze({
            entries,
            orders,
            riskProfile,
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      const next = data.budget as RiskBudgetResult;
      setBudget(next);
      saveClientRiskBudget(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Optimize failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const cached = loadClientRiskBudget();
    if (cached) setBudget(cached);
    void refresh();
  }, [refresh]);

  return (
    <OpsShell
      badge="Risk Budget"
      title="Risk Budget Optimizer"
      subtitle="Portfolio-aware position sizing — may reduce risk automatically; cannot increase beyond governance max."
      accent="rose"
      iconLetters="RB"
      activePath="/risk-budget"
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-900/40 disabled:opacity-50"
        >
          {busy ? "Optimizing…" : "Refresh budget"}
        </button>
      }
    >
      <p className="mb-4 text-xs text-zinc-500">{RISK_BUDGET_SAFETY_NOTICE}</p>
      {error && (
        <p className="mb-4 rounded border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi
          label="Recommended risk"
          value={budget ? `${budget.recommendedRiskPct}%` : "—"}
          hint={budget ? `$${budget.recommendedPositionSizeUsd} notional` : undefined}
        />
        <OpsKpi
          label="Max allowed"
          value={budget ? `${budget.maxAllowedRiskPct}%` : "—"}
          hint="Governance cap"
        />
        <OpsKpi
          label="Budget remaining"
          value={budget ? `${budget.riskBudgetRemainingPct}%` : "—"}
        />
        <OpsKpi
          label="Live trading"
          value={budget?.liveTradingAllowed ? "Allowed" : "Blocked"}
          hint={budget?.liveTradingAllowed ? "Subject to approval" : "See block reasons"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Current risk budget">
          {budget ? (
            <div className="space-y-2 text-sm text-zinc-300">
              <p>
                Recommended:{" "}
                <span className="font-semibold text-rose-200">
                  {budget.recommendedRiskPct}%
                </span>{" "}
                (${budget.recommendedPositionSizeUsd})
              </p>
              <p className="text-xs text-zinc-500">
                Headroom {budget.riskBudgetRemainingPct}% · max{" "}
                {budget.maxAllowedRiskPct}%
              </p>
              {budget.sizeReductionReasons.map((r) => (
                <p key={r} className="text-xs text-amber-300/90">
                  ↓ {r}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Run optimizer to compute budget.</p>
          )}
        </Panel>

        <Panel title="Daily / weekly loss limit">
          {budget ? (
            <div className="space-y-1 text-xs text-zinc-400">
              <p>
                Daily: {budget.dailyLossLimitPct}% limit · used{" "}
                {budget.dailyLossUsedPct}%
              </p>
              <p>
                Weekly: {budget.weeklyLossLimitPct}% limit · used{" "}
                {budget.weeklyLossUsedPct}%
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">—</p>
          )}
        </Panel>

        <Panel title="Strategy allocation">
          {budget?.strategyRiskAllocation.length ? (
            <ul className="space-y-1 text-xs text-zinc-400">
              {budget.strategyRiskAllocation.map((s) => (
                <li key={s.strategyId}>
                  {s.label}: open {s.openExposurePct}% · recommend{" "}
                  {s.recommendedPct}%
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No open strategy exposure.</p>
          )}
        </Panel>

        <Panel title="Asset allocation">
          {budget?.assetRiskAllocation.length ? (
            <ul className="space-y-1 text-xs text-zinc-400">
              {budget.assetRiskAllocation.map((a) => (
                <li key={a.asset}>
                  {a.asset}: open {a.openExposurePct}% · recommend {a.recommendedPct}%
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">—</p>
          )}
        </Panel>

        <Panel title="Suggested position size">
          {budget ? (
            <div className="text-sm text-zinc-300">
              <p className="text-lg font-semibold text-rose-200">
                {budget.recommendedRiskPct}% · ${budget.recommendedPositionSizeUsd}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Applied to paper orders, options preview, and live pilot guards.
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">—</p>
          )}
        </Panel>

        <Panel title="Block reasons">
          {budget?.blockReasons.length ? (
            <ul className="space-y-1 text-xs text-rose-300/90">
              {budget.blockReasons.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No active blocks.</p>
          )}
        </Panel>

        <Panel title="Risk budget timeline">
          {budget?.timeline.length ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-[11px] text-zinc-500">
              {budget.timeline.map((pt) => (
                <li key={pt.timestamp}>
                  {new Date(pt.timestamp).toLocaleString()} · equity $
                  {pt.equityUsd.toFixed(0)} · budget used {pt.budgetUsedPct}%
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">Timeline builds from equity curve.</p>
          )}
        </Panel>
      </div>
    </OpsShell>
  );
}
