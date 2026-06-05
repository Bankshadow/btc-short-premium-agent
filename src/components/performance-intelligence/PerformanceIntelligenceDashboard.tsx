"use client";

import { useCallback, useEffect, useState } from "react";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { loadEvaluationResults } from "@/lib/self-learning";
import { loadPersistedRegistry } from "@/lib/strategy-registry/strategy-registry-store";
import { loadDiscoveredProposals } from "@/lib/rule-discovery/proposal-store";
import { loadAdaptationAuditLog } from "@/lib/strategy-adaptation/proposal-store";
import { loadAdaptiveWeightingAudit } from "@/lib/adaptive-agent-weighting/audit-log";
import { loadOperatorOverrideLog } from "@/lib/governance/operator-override-log";
import { loadGovernanceAuditLog } from "@/lib/governance/governance-audit-log";
import type { PerformanceIntelligenceReport } from "@/lib/performance-intelligence/types";
import { PERFORMANCE_INTELLIGENCE_SAFETY_NOTICE } from "@/lib/performance-intelligence/types";

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

function trendClass(direction: string): string {
  if (direction === "IMPROVING") return "text-emerald-400";
  if (direction === "DECLINING") return "text-rose-400";
  return "text-amber-300";
}

export default function PerformanceIntelligenceDashboard() {
  const [report, setReport] = useState<PerformanceIntelligenceReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    const govAudit = loadGovernanceAuditLog();
    try {
      const res = await fetch("/api/performance-intelligence/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: loadDecisionLog(),
          orders: loadPaperOrders(),
          riskProfile: loadDeskSettings().riskProfile,
          storedEvaluations: loadEvaluationResults(),
          persistedRegistry: loadPersistedRegistry(),
          ruleProposals: loadDiscoveredProposals(),
          adaptationAudit: loadAdaptationAuditLog(),
          adaptiveWeightingAudit: loadAdaptiveWeightingAudit(),
          operatorOverrideLog: loadOperatorOverrideLog(),
          governanceAuditCount: govAudit.length,
          governanceLastChangeAt: govAudit[0]?.timestamp ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      setReport(data.report as PerformanceIntelligenceReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <OpsShell
      badge="Performance Intelligence"
      title="AI Performance Intelligence"
      subtitle="Measures whether the trading desk is improving over time — traceable to versions, rules, strategies, and agents."
      accent="violet"
      iconLetters="PI"
      activePath="/performance-intelligence"
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-lg border border-violet-800 bg-violet-950/40 px-4 py-2 text-sm font-medium text-violet-100 hover:bg-violet-900/40 disabled:opacity-50"
        >
          {busy ? "Computing…" : "Refresh report"}
        </button>
      }
    >
      <p className="mb-4 text-xs text-zinc-500">{PERFORMANCE_INTELLIGENCE_SAFETY_NOTICE}</p>
      {error && (
        <p className="mb-4 rounded border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi
          label="Improvement trend"
          value={report?.improvementTrend.direction ?? "—"}
          hint={report?.improvementTrend.summary}
        />
        <OpsKpi
          label="Committee accuracy"
          value={
            report ? `${report.committeeAccuracy.accuracyPct}%` : "—"
          }
          hint={`${report?.committeeAccuracy.correctVerdicts ?? 0} correct verdicts`}
        />
        <OpsKpi
          label="False TRADE / SKIP"
          value={
            report
              ? `${report.falseSignalReport.falseTrades} / ${report.falseSignalReport.falseSkips}`
              : "—"
          }
          hint={`Regret ${report?.falseSignalReport.avgRegretScore ?? 0}`}
        />
        <OpsKpi
          label="Risk veto quality"
          value={
            report ? `${report.riskManagerVetoQuality.accuracyPct}%` : "—"
          }
          hint={`${report?.riskManagerVetoQuality.totalVetoes ?? 0} vetoes`}
        />
      </div>

      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 font-mono text-[11px] text-zinc-500">
        Versions: policy {report?.versions.aiPolicyVersion ?? "—"} · registry{" "}
        {report?.versions.strategyRegistryVersion ?? "—"} · rules{" "}
        {report?.versions.ruleSetVersion ?? "—"} · weights{" "}
        {report?.versions.agentWeightVersion ?? "—"} · gov{" "}
        {report?.versions.governanceVersion ?? "—"}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="AI improvement trend">
          {report ? (
            <div className="space-y-2 text-sm text-zinc-300">
              <p className={`font-semibold ${trendClass(report.improvementTrend.direction)}`}>
                {report.improvementTrend.direction}
              </p>
              <p className="text-xs text-zinc-500">{report.improvementTrend.summary}</p>
              <ul className="text-xs text-zinc-400">
                <li>Weekly Δ win rate: {report.improvementTrend.weeklyDeltaWinRate}%</li>
                <li>Monthly Δ win rate: {report.improvementTrend.monthlyDeltaWinRate}%</li>
                <li>Weekly Δ avg PnL: {report.improvementTrend.weeklyDeltaPnl}%</li>
              </ul>
              {report.weeklyPerformance.slice(-4).map((w) => (
                <p key={w.periodKey} className="font-mono text-[11px] text-zinc-500">
                  {w.periodLabel}: {w.winRate}% win · {w.netPnlPct}% net · committee{" "}
                  {w.committeeAccuracy}%
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Loading…</p>
          )}
        </Panel>

        <Panel title="Version comparison">
          {report?.versionComparisons.length ? (
            <ul className="space-y-2 text-xs text-zinc-400">
              {report.versionComparisons.map((c) => (
                <li key={c.dimension} className="rounded border border-zinc-800 p-2">
                  <span className="text-violet-300">{c.dimension}</span>: {c.previousValue}{" "}
                  → {c.currentValue} (Δ {c.delta})
                  <p className="mt-1 text-zinc-500">{c.interpretation}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">Need more periods for comparisons.</p>
          )}
        </Panel>

        <Panel title="Agent contribution">
          {report?.agentContribution.length ? (
            <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
              {report.agentContribution.slice(0, 8).map((a) => (
                <li
                  key={a.agentName}
                  className="flex justify-between gap-2 border-b border-zinc-800/80 py-1 text-zinc-300"
                >
                  <span>{a.agentName}</span>
                  <span className="font-mono text-violet-300">{a.contributionScore}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No agent data.</p>
          )}
        </Panel>

        <Panel title="Rule impact">
          {report?.ruleImpact.length ? (
            <ul className="space-y-2 text-xs text-zinc-400">
              {report.ruleImpact.map((r) => (
                <li key={r.ruleId}>
                  {r.title}: before {r.winRateBefore}% → after {r.winRateAfter}%
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No approved rules with before/after window.</p>
          )}
        </Panel>

        <Panel title="Strategy change impact">
          {report?.strategyChangeImpact.length ? (
            <ul className="space-y-2 text-xs text-zinc-400">
              {report.strategyChangeImpact.map((s) => (
                <li key={`${s.strategyId}-${s.changeAt}`}>
                  {s.strategyId}: {s.changeNote} · PnL {s.pnlBefore} → {s.pnlAfter} · DD after{" "}
                  {s.drawdownAfterChange}%
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No applied adaptation changes yet.</p>
          )}
        </Panel>

        <Panel title="Regime performance">
          {report?.regimePerformance.length ? (
            <ul className="space-y-1 text-xs text-zinc-400">
              {report.regimePerformance.map((r) => (
                <li key={r.regime}>
                  {r.regime}: {r.winRate}% · n={r.sampleSize}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No regime slices.</p>
          )}
        </Panel>

        <Panel title="False positive / false negative report">
          {report ? (
            <div className="space-y-2 text-xs text-zinc-400">
              <p>
                False TRADE: {report.falseSignalReport.falseTrades} · False SKIP:{" "}
                {report.falseSignalReport.falseSkips}
              </p>
              <p>
                Opportunity cost R: {report.falseSignalReport.opportunityCostR} · Avoided loss R:{" "}
                {report.falseSignalReport.avoidedLossR}
              </p>
              <p>
                Top false TRADE agents:{" "}
                {report.falseSignalReport.topFalseTradeAgents.join(", ") || "—"}
              </p>
              <p>
                Top false SKIP agents:{" "}
                {report.falseSignalReport.topFalseSkipAgents.join(", ") || "—"}
              </p>
              {report.falseSignalReport.examples.slice(0, 4).map((ex) => (
                <p key={ex.decisionLogId} className="text-zinc-500">
                  {ex.type} · {ex.regime} · {ex.pnlPct}%
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Loading…</p>
          )}
        </Panel>

        <Panel title="Strict vs relaxed · weighted vs original · human override">
          {report ? (
            <div className="space-y-2 text-xs text-zinc-400">
              <p>{report.strictVsRelaxed.summary}</p>
              <p>{report.weightedVsOriginal.summary}</p>
              <p>{report.humanOverrideVsAi.summary}</p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Loading…</p>
          )}
        </Panel>
      </div>
    </OpsShell>
  );
}
