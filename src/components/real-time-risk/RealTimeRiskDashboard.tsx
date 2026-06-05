"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import {
  loadLivePilotJournal,
  loadPilotEmergencyStop,
} from "@/lib/live-pilot/journal-store";
import { getOpenPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadClientRiskBudget } from "@/lib/risk-budget-optimizer/client-store";
import { REALTIME_RISK_SAFETY_NOTICE } from "@/lib/real-time-risk/types";
import type {
  RealTimeRiskReport,
  RealTimeRiskStatus,
} from "@/lib/real-time-risk/types";

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

function statusClass(status: RealTimeRiskStatus): string {
  if (status === "SAFE") return "text-emerald-300 border-emerald-800/50 bg-emerald-950/30";
  if (status === "CAUTION") return "text-amber-300 border-amber-800/50 bg-amber-950/30";
  if (status === "BLOCKED") return "text-rose-300 border-rose-800/50 bg-rose-950/30";
  return "text-red-200 border-red-700/60 bg-red-950/40 animate-pulse";
}

function checkStatusClass(status: string): string {
  if (status === "PASS") return "text-emerald-400";
  if (status === "WARNING") return "text-amber-400";
  if (status === "FAIL") return "text-rose-400";
  return "text-red-300";
}

export default function RealTimeRiskDashboard() {
  const [report, setReport] = useState<RealTimeRiskReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventMsg, setEventMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/risk/realtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: loadDecisionLog(),
          orders: loadPaperOrders(),
          perpPositions: getOpenPerpPositions(),
          liveTrades: loadLivePilotJournal(),
          governance: loadGovernanceState(),
          incidents: loadIncidents(),
          riskBudget: loadClientRiskBudget(),
          emergencyStopActive: loadPilotEmergencyStop(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      setReport(data.report as RealTimeRiskReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const logReviewEvent = async () => {
    setBusy(true);
    setEventMsg(null);
    try {
      const res = await fetch("/api/risk/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "operator_review",
          severity: "info",
          message: "Operator reviewed real-time risk dashboard.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Event failed");
      setEventMsg("Review event logged.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Event failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OpsShell
      badge="MVP 42 · Real-time risk"
      title="Real-Time Risk Engine"
      subtitle="Continuous portfolio, exposure, margin, and limit monitoring — blocks new trades when unsafe."
      accent="rose"
      iconLetters="RT"
      activePath="/real-time-risk"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/command-center", label: "Command" },
        { href: "/live-pilot", label: "Live pilot", primary: true },
      ]}
    >
      <p className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-2 text-xs text-rose-200/90">
        {REALTIME_RISK_SAFETY_NOTICE}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
        <button
          type="button"
          onClick={() => void logReviewEvent()}
          disabled={busy}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          Log review event
        </button>
        <Link
          href="/command-center"
          className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/40"
        >
          Command center →
        </Link>
      </div>

      {report && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${statusClass(report.riskStatus)}`}
        >
          {report.riskStatus}
          {report.blockNewTrades && " — new trades blocked"}
          {report.reduceOnlyMode && " — reduce-only"}
        </div>
      )}

      {report && (
        <div className="grid gap-3 sm:grid-cols-4">
          <OpsKpi
            label="Block new trades"
            value={report.blockNewTrades ? "YES" : "NO"}
            hint="Live pilot + exchange"
          />
          <OpsKpi
            label="Block increase"
            value={report.blockIncreaseExposure ? "YES" : "NO"}
            hint="Exposure caps"
          />
          <OpsKpi
            label="Notional"
            value={`$${report.metrics.totalNotionalUsd.toFixed(0)}`}
            hint="Combined exposure"
          />
          <OpsKpi
            label="Daily PnL"
            value={`${report.metrics.dailyPnlPct.toFixed(2)}%`}
            hint={`Weekly ${report.metrics.weeklyPnlPct.toFixed(2)}%`}
          />
        </div>
      )}

      {error && (
        <p className="rounded border border-rose-900/50 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}
      {eventMsg && (
        <p className="rounded border border-emerald-900/40 px-3 py-2 text-xs text-emerald-300">
          {eventMsg}
        </p>
      )}

      {report && report.recommendedActions.length > 0 && (
        <Panel title="Recommended actions">
          <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-300">
            {report.recommendedActions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Panel>
      )}

      {report && report.triggeredLimits.length > 0 && (
        <Panel title="Triggered limits">
          <div className="flex flex-wrap gap-2">
            {report.triggeredLimits.map((l) => (
              <span
                key={l}
                className="rounded border border-rose-900/50 bg-rose-950/30 px-2 py-0.5 text-xs text-rose-200"
              >
                {l}
              </span>
            ))}
          </div>
        </Panel>
      )}

      {report && (
        <Panel title="Risk checks">
          <ul className="space-y-2 text-xs">
            {report.checks.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800/60 pb-2"
              >
                <span className="font-medium text-zinc-200">{c.label}</span>
                <span className={checkStatusClass(c.status)}>{c.status}</span>
                <span className="w-full text-zinc-500">{c.message}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {report && report.riskEvents.length > 0 && (
        <Panel title="Recent risk events">
          <ul className="space-y-1 text-xs text-zinc-400">
            {report.riskEvents.slice(0, 12).map((e) => (
              <li key={e.eventId}>
                <span className="text-zinc-500">{e.recordedAt.slice(11, 19)}</span>{" "}
                <span className="text-zinc-300">{e.eventType}</span> — {e.message}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </OpsShell>
  );
}
