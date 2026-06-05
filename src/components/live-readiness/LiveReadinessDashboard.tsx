"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { loadOperatorOverrideLog } from "@/lib/governance/operator-override-log";
import { buildLiveReadinessReport } from "@/lib/live-readiness/build-readiness-report";
import { loadBacktestReadinessBridge } from "@/lib/historical-backtest/client-bridge";
import { loadClientRiskBudget } from "@/lib/risk-budget-optimizer/client-store";
import type {
  LiveReadinessReport,
  ReadinessCategoryResult,
  ServerReadinessContext,
} from "@/lib/live-readiness/types";

function statusStyles(status: string): string {
  if (status === "PASS") return "bg-emerald-900/50 text-emerald-200 ring-emerald-700/40";
  if (status === "WARNING") return "bg-amber-900/50 text-amber-200 ring-amber-700/40";
  return "bg-rose-900/50 text-rose-200 ring-rose-700/40";
}

function scoreBar(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

function CategoryCard({ cat }: { cat: ReadinessCategoryResult }) {
  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-zinc-100">{cat.label}</h3>
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${statusStyles(cat.status)}`}
        >
          {cat.status}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full ${scoreBar(cat.score)}`}
            style={{ width: `${cat.score}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-zinc-500">{cat.score}</span>
      </div>
      <ul className="mt-2 space-y-1 text-[11px] text-zinc-400">
        {cat.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {cat.blockingIssues.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-rose-300/90">
          {cat.blockingIssues.map((b) => (
            <li key={b}>Blocker: {b}</li>
          ))}
        </ul>
      )}
      {cat.recommendedActions.length > 0 && (
        <ul className="mt-2 space-y-1 text-[10px] text-indigo-300/80">
          {cat.recommendedActions.map((a) => (
            <li key={a}>→ {a}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function LiveReadinessDashboard() {
  const [report, setReport] = useState<LiveReadinessReport | null>(null);
  const [serverContext, setServerContext] = useState<ServerReadinessContext | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportMarkdown, setExportMarkdown] = useState<string | null>(null);

  const buildPayload = useCallback(() => {
    return {
      entries: loadDecisionLog(),
      orders: loadPaperOrders(),
      perpPositions: loadPerpPositions(),
      riskProfile: loadDeskSettings().riskProfile,
      governance: loadGovernanceState(),
      incidents: loadIncidents(),
      overrideLog: loadOperatorOverrideLog(),
      deskSettings: loadDeskSettings(),
      latestAnalysis: null,
      backtestBridge: loadBacktestReadinessBridge(),
      riskBudget: loadClientRiskBudget(),
    };
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    const payload = buildPayload();
    try {
      const res = await fetch("/api/live-readiness");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);

      const ctx = data.serverContext as ServerReadinessContext;
      const merged = buildLiveReadinessReport({
        ...payload,
        serverContext: ctx,
      });
      setServerContext(ctx);
      setReport(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Readiness check failed");
    } finally {
      setBusy(false);
    }
  }, [buildPayload]);

  const exportReport = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/live-readiness/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildPayload(), format: "all" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setExportMarkdown(data.markdown as string);
      const blob = new Blob([data.markdown as string], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `live-readiness-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const live = report?.liveModeVisibility;
  const metrics = report?.strictPaperMetrics;

  return (
    <OpsShell
      badge="MVP 25 · Read-only"
      title="Live Readiness"
      subtitle="Pre-flight checklist for small live perp pilot — reports only, cannot enable live execution or place trades."
      accent="emerald"
      iconLetters="LR"
      activePath="/live-readiness"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/governance", label: "Governance" },
        { href: "/validation", label: "Validation", primary: true },
        { href: "/automation", label: "Automation" },
      ]}
      actions={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="rounded-lg border border-emerald-800/60 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-950/40 disabled:opacity-50"
          >
            {busy ? "Checking…" : "Refresh checklist"}
          </button>
          <button
            type="button"
            disabled={busy || !report}
            onClick={() => void exportReport()}
            className="rounded-lg bg-emerald-700/90 px-3 py-2 text-xs font-semibold text-zinc-100 disabled:opacity-50"
          >
            Export report
          </button>
        </>
      }
    >
      <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-2 text-xs text-emerald-200/80">
        {report?.safetyNotice ??
          "This dashboard cannot enable live execution or place trades."}
      </p>
      {error && <p className="text-sm text-amber-400">{error}</p>}

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OpsKpi
              label="Overall readiness"
              value={report.overallStatus}
              hint={`Score ${report.overallScore}/100`}
            />
            <OpsKpi
              label="Perp pilot ready"
              value={report.readyForSmallLivePerpPilot ? "YES" : "NO"}
              hint="Strict paper + server gates"
            />
            <OpsKpi
              label="Hard blockers"
              value={String(report.hardBlockers.length)}
              hint={report.hardBlockers.length ? "Must clear first" : "None"}
            />
            <OpsKpi
              label="Strict closed trades"
              value={String(metrics?.closedTrades ?? 0)}
              hint={`${metrics?.relaxedExcludedCount ?? 0} relaxed excluded`}
            />
          </div>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">
              Live mode visibility (read-only)
            </h2>
            <p className="mt-1 text-[11px] text-zinc-500">
              BTC options live is not implemented. Perp live remains env-gated on the
              exchange panel.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-zinc-800 px-3 py-2 text-xs">
                <p className="text-[10px] uppercase text-zinc-500">
                  LIVE_EXECUTION_ENABLED
                </p>
                <p
                  className={`mt-1 font-semibold ${live?.liveExecutionEnabled ? "text-amber-300" : "text-emerald-300"}`}
                >
                  {live?.liveExecutionEnabled ? "ON" : "OFF"}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 px-3 py-2 text-xs">
                <p className="text-[10px] uppercase text-zinc-500">Double confirm</p>
                <p className="mt-1 font-semibold text-zinc-200">
                  {live?.requireDoubleConfirm ? "Required" : "Disabled"}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 px-3 py-2 text-xs">
                <p className="text-[10px] uppercase text-zinc-500">Exchange</p>
                <p className="mt-1 font-semibold text-zinc-200">
                  {live?.exchangeConfigured ? "Keys set" : "Missing keys"} ·{" "}
                  {live?.exchangeConnected ? "Connected" : "Not connected"}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 px-3 py-2 text-xs">
                <p className="text-[10px] uppercase text-zinc-500">Network</p>
                <p className="mt-1 font-semibold text-zinc-200">
                  {live?.network ?? "n/a"}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 px-3 py-2 text-xs">
                <p className="text-[10px] uppercase text-zinc-500">Max notional</p>
                <p className="mt-1 font-semibold text-zinc-200">
                  ${live?.maxLiveNotionalUsd ?? "—"}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400">
                {live?.note}
              </div>
            </div>
            <p className="mt-3 text-[10px] text-zinc-600">
              To change live mode, update server environment variables — this page
              does not provide a toggle.
            </p>
            <Link
              href="/governance"
              className="mt-2 inline-block text-xs text-emerald-400 hover:underline"
            >
              Exchange status on governance →
            </Link>
          </section>

          {report.hardBlockers.length > 0 && (
            <section className="desk-panel border-rose-900/40 px-5 py-4">
              <h2 className="text-sm font-semibold text-rose-300">Blockers</h2>
              <ul className="mt-2 space-y-1 text-xs text-rose-200/90">
                {report.hardBlockers.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">
              Recommended next actions
            </h2>
            {report.recommendedNextActions.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No actions — checklist clear.</p>
            ) : (
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-zinc-400">
                {report.recommendedNextActions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
            )}
          </section>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Category checklist</h2>
            <ul className="mt-3 grid gap-3 lg:grid-cols-2">
              {report.categories.map((cat) => (
                <CategoryCard key={cat.id} cat={cat} />
              ))}
            </ul>
          </section>

          {metrics && (
            <section className="desk-panel px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-100">
                Strict paper performance (relaxed excluded)
              </h2>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-400">
                <span>Win rate: {metrics.winRate}%</span>
                <span>Avg PnL: {metrics.avgPnlPct}%</span>
                <span>Max DD: {metrics.maxDrawdownPct}%</span>
                <span>Loss streak: {metrics.recentLossStreak}</span>
                <span>Expectancy: {metrics.expectancy}%</span>
              </div>
            </section>
          )}

          {exportMarkdown && (
            <section className="desk-panel px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-100">Exported preview</h2>
              <pre className="ops-memo mt-2 max-h-48 overflow-auto text-[10px]">
                {exportMarkdown.slice(0, 2000)}
                {exportMarkdown.length > 2000 ? "…" : ""}
              </pre>
            </section>
          )}

          {serverContext && (
            <p className="text-[10px] text-zinc-600">
              Server snapshot: {new Date(serverContext.timestamp).toLocaleString()}
            </p>
          )}
        </>
      )}
    </OpsShell>
  );
}
