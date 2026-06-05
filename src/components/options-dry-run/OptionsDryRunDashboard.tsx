"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadOptionsPreviewJournal } from "@/lib/options-execution/preview-journal-store";
import {
  appendOptionsDryRunResult,
  loadOptionsDryRunHistory,
} from "@/lib/options-dry-run/dry-run-client-store";
import { OPTIONS_DRY_RUN_SAFETY_NOTICE } from "@/lib/options-dry-run/types";
import type {
  OptionsDryRunPerformanceReport,
  OptionsDryRunResult,
} from "@/lib/options-dry-run/types";
import { loadPaperOrders } from "@/lib/paper/paper-orders";

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

function statusClass(status: string): string {
  if (status === "PASS") return "text-emerald-300";
  if (status === "WARNING") return "text-amber-300";
  return "text-rose-300";
}

export default function OptionsDryRunDashboard() {
  const [history, setHistory] = useState<OptionsDryRunResult[]>([]);
  const [report, setReport] = useState<OptionsDryRunPerformanceReport | null>(null);
  const [lastResult, setLastResult] = useState<OptionsDryRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const clientPayload = useCallback(
    () => ({
      entries: loadDecisionLog(),
      orders: loadPaperOrders(),
      governance: loadGovernanceState(),
      incidents: loadIncidents(),
      journal: loadOptionsPreviewJournal(),
      history: loadOptionsDryRunHistory(),
      paperOrders: loadPaperOrders(),
    }),
    [],
  );

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/options/dry-run/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientPayload()),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Report failed");
      setReport(data.report as OptionsDryRunPerformanceReport);
      setHistory(loadOptionsDryRunHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }, [clientPayload]);

  useEffect(() => {
    setHistory(loadOptionsDryRunHistory());
    void refresh();
  }, [refresh]);

  const runDryRunForLatest = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    const entries = loadDecisionLog();
    const latest = entries.find(
      (e) =>
        e.finalVerdict === "TRADE" &&
        e.orderTicket &&
        (e.orderTicket.instrument === "sell_call" ||
          e.orderTicket.instrument === "sell_put"),
    );
    if (!latest?.orderTicket) {
      setError(
        "No TRADE decision with order ticket — run Analyze on desk first.",
      );
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/options/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...clientPayload(),
          ticket: latest.orderTicket,
          decisionLogId: latest.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Dry-run failed");
      const result = data.result as OptionsDryRunResult;
      appendOptionsDryRunResult(result);
      setLastResult(result);
      setHistory(loadOptionsDryRunHistory());
      setMsg(
        result.wouldSubmit
          ? `Dry-run ACCEPT — would submit if live were enabled.`
          : `Dry-run REJECT — ${result.rejectionReasons[0] ?? "blocked"}`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dry-run failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OpsShell
      badge="MVP 44 · Options dry-run"
      title="BTC Options Live Dry-Run Gate"
      subtitle="Production-like would-be-live checks — no real orders, no exchange writes."
      accent="violet"
      iconLetters="DR"
      activePath="/options-dry-run"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/options-live-readiness", label: "Options ready" },
        { href: "/options-testnet", label: "Testnet", primary: true },
      ]}
    >
      <p className="rounded-lg border border-violet-900/50 bg-violet-950/25 px-4 py-2 text-xs font-medium text-violet-200">
        ⚠ DRY-RUN ONLY — {OPTIONS_DRY_RUN_SAFETY_NOTICE}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void runDryRunForLatest()}
          disabled={busy}
          className="rounded-lg border border-violet-800 bg-violet-950/50 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-900/40 disabled:opacity-50"
        >
          {busy ? "Running…" : "Dry-run latest TRADE candidate"}
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          Refresh report
        </button>
        <Link
          href="/options-live-readiness"
          className="rounded-lg border border-violet-900/50 bg-violet-950/30 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-900/40"
        >
          Live readiness →
        </Link>
      </div>

      {report && (
        <div className="grid gap-3 sm:grid-cols-4">
          <OpsKpi label="Dry-runs" value={String(report.totalDryRuns)} hint="Logged" />
          <OpsKpi
            label="Would submit"
            value={String(report.wouldSubmitCount)}
            hint="Hypothetical live pass"
          />
          <OpsKpi
            label="Gate ready"
            value={report.readinessContribution.readyForLiveGate ? "YES" : "NO"}
            hint={`${report.readinessContribution.wouldSubmitRatePct}% pass rate`}
          />
          <OpsKpi
            label="Paper align"
            value={`${report.paperVsDryRun.paperWouldSubmitMatchPct}%`}
            hint="Paper vs dry-run"
          />
        </div>
      )}

      {error && (
        <p className="rounded border border-rose-900/50 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}
      {msg && (
        <p className="rounded border border-emerald-900/40 px-3 py-2 text-xs text-emerald-300">
          {msg}
        </p>
      )}

      {lastResult && (
        <Panel title="Latest dry-run result">
          <div className="grid gap-2 text-xs text-zinc-300 sm:grid-cols-2">
            <div>
              <span className="text-zinc-500">ID</span> {lastResult.dryRunId}
            </div>
            <div>
              <span className="text-zinc-500">Instrument</span> {lastResult.instrument}
            </div>
            <div>
              <span className="text-zinc-500">Exchange sim</span>{" "}
              <span className={statusClass(lastResult.riskStatus)}>
                {lastResult.simulatedExchangeDecision}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Would submit</span>{" "}
              {lastResult.wouldSubmit ? "YES" : "NO"}
            </div>
            <div>
              <span className="text-zinc-500">Premium</span> ${lastResult.premium}
            </div>
            <div>
              <span className="text-zinc-500">Spread</span> {lastResult.bidAskSpread}%
            </div>
            <div>
              <span className="text-zinc-500">Margin est.</span> $
              {lastResult.estimatedMargin}
            </div>
            <div>
              <span className="text-zinc-500">Greeks</span> Δ{lastResult.delta} Γ
              {lastResult.gamma} Θ{lastResult.theta} V{lastResult.vega}
            </div>
          </div>
          {lastResult.rejectionReasons.length > 0 && (
            <ul className="mt-3 list-disc pl-4 text-xs text-rose-300/90">
              {lastResult.rejectionReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {lastResult.preview.riskChecks.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {lastResult.preview.riskChecks.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span className="text-zinc-400">{c.label}</span>
                  <span className={statusClass(c.status)}>{c.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {report && (
        <Panel title="Rejection analysis">
          <ul className="space-y-1 text-xs text-zinc-400">
            <li>Missed — liquidity: {report.missedDueToLiquidity}</li>
            <li>Missed — margin: {report.missedDueToMargin}</li>
            <li>Rejected — governance: {report.rejectedByGovernance}</li>
            <li>Rejected — risk engine: {report.rejectedByRiskEngine}</li>
          </ul>
          {report.rejectedTradeAnalysis.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {report.rejectedTradeAnalysis.map((r) => (
                <li key={r.category} className="text-zinc-300">
                  {r.category}: {r.count} — {r.reason}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {history.length > 0 && (
        <Panel title="Dry-run history">
          <ul className="space-y-2 text-xs">
            {history.slice(0, 15).map((h) => (
              <li
                key={h.dryRunId}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800/50 pb-2"
              >
                <span className="text-zinc-300">{h.instrument}</span>
                <span className={h.wouldSubmit ? "text-emerald-400" : "text-rose-400"}>
                  {h.simulatedExchangeDecision}
                </span>
                <span className="w-full text-zinc-500">
                  {h.createdAt.slice(0, 19)} · ${h.premium} · {h.rejectionCategory ?? "ok"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </OpsShell>
  );
}
