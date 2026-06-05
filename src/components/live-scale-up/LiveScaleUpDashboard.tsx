"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { applyScaleUpClientAction } from "@/lib/live-scale-up/apply-client-action";
import { LIVE_SCALE_UP_SAFETY_NOTICE } from "@/lib/live-scale-up/types";
import type { LiveScaleStage, ScaleUpReport } from "@/lib/live-scale-up/types";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import {
  appendClientApprovalRecord,
  loadClientScaleStage,
  loadClientApprovalHistory,
  saveClientScaleStage,
} from "@/lib/live-scale-up/scale-client-store";
import {
  loadLivePilotJournal,
  loadPilotEmergencyStop,
} from "@/lib/live-pilot/journal-store";
import { getOpenPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadClientRiskBudget } from "@/lib/risk-budget-optimizer/client-store";

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

function stageClass(stage: LiveScaleStage): string {
  if (stage === "LIVE_STAGE_0_DISABLED") {
    return "text-zinc-300 border-zinc-700/50 bg-zinc-900/40";
  }
  if (stage === "LIVE_STAGE_4_CONTROLLED_PRODUCTION") {
    return "text-emerald-300 border-emerald-800/50 bg-emerald-950/30";
  }
  return "text-amber-300 border-amber-800/50 bg-amber-950/30";
}

export default function LiveScaleUpDashboard() {
  const [report, setReport] = useState<ScaleUpReport | null>(null);
  const [currentStage, setCurrentStage] = useState<LiveScaleStage>(
    loadClientScaleStage(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [operatorNote, setOperatorNote] = useState("");

  const clientPayload = useCallback(
    () => ({
      currentStage: loadClientScaleStage(),
      journal: loadLivePilotJournal(),
      incidents: loadIncidents(),
      entries: loadDecisionLog(),
      orders: loadPaperOrders(),
      perpPositions: getOpenPerpPositions(),
      riskProfile: loadDeskSettings().riskProfile,
      governance: loadGovernanceState(),
      riskBudget: loadClientRiskBudget(),
      emergencyStopActive: loadPilotEmergencyStop(),
      approvalHistory: loadClientApprovalHistory(),
    }),
    [],
  );

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/live-scale-up/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientPayload()),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      setReport(data.report as ScaleUpReport);
      setCurrentStage(data.currentStage as LiveScaleStage);
      if (data.autoDemoted) {
        saveClientScaleStage(data.currentStage as LiveScaleStage);
        const record = (data.report as ScaleUpReport).approvalHistory[0];
        if (record) appendClientApprovalRecord(record);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }, [clientPayload]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 45_000);
    return () => clearInterval(id);
  }, [refresh]);

  const promote = async () => {
    if (!report?.promotion.targetStage) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/live-scale-up/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...clientPayload(),
          targetStage: report.promotion.targetStage,
          operatorApproval: true,
          operatorNote,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? data.message ?? "Promotion failed");
      }
      applyScaleUpClientAction(data);
      setMsg(data.message as string);
      setReport(data.report as ScaleUpReport);
      setCurrentStage(data.currentStage as LiveScaleStage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promotion failed");
    } finally {
      setBusy(false);
    }
  };

  const demote = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/live-scale-up/demote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...clientPayload(),
          operatorNote: operatorNote || "Operator manual demotion.",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? data.message ?? "Demotion failed");
      }
      applyScaleUpClientAction(data);
      setMsg(data.message as string);
      setReport(data.report as ScaleUpReport);
      setCurrentStage(data.currentStage as LiveScaleStage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demotion failed");
    } finally {
      setBusy(false);
    }
  };

  const def = report?.currentStageDefinition;

  return (
    <OpsShell
      badge="MVP 43 · Live scale-up"
      title="Live Perp Scale-Up Framework"
      subtitle="Staged risk scaling after pilot — promotion requires approval, demotion may be automatic."
      accent="emerald"
      iconLetters="SU"
      activePath="/live-scale-up"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/live-pilot", label: "Live pilot" },
        { href: "/real-time-risk", label: "Risk RT", primary: true },
      ]}
    >
      <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-2 text-xs text-emerald-200/90">
        {LIVE_SCALE_UP_SAFETY_NOTICE}
      </p>

      <div
        className={`rounded-xl border px-4 py-3 text-sm font-semibold ${stageClass(currentStage)}`}
      >
        {currentStage.replace("LIVE_STAGE_", "Stage ").replace(/_/g, " ")}
        {def ? ` — ${def.label}` : ""}
        {report && !report.tradingAllowed ? " · Trading blocked" : ""}
      </div>

      {report && (
        <div className="grid gap-3 sm:grid-cols-4">
          <OpsKpi label="Trading" value={report.tradingAllowed ? "ON" : "OFF"} hint="Stage + risk" />
          <OpsKpi
            label="Max notional"
            value={`$${def?.maxNotionalPerTrade ?? 0}`}
            hint="Per trade"
          />
          <OpsKpi
            label="Closed trades"
            value={String(report.performance.closedTrades)}
            hint={`Win ${report.performance.winRatePct}%`}
          />
          <OpsKpi
            label="Promotion"
            value={report.promotion.eligible ? "READY" : "BLOCKED"}
            hint={report.nextStage ?? "max stage"}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
        {report?.promotion.eligible && report.promotion.targetStage && (
          <button
            type="button"
            onClick={() => void promote()}
            disabled={busy}
            className="rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-50"
          >
            Promote → {report.promotion.targetStage.replace("LIVE_STAGE_", "")}
          </button>
        )}
        {currentStage !== "LIVE_STAGE_0_DISABLED" && (
          <button
            type="button"
            onClick={() => void demote()}
            disabled={busy}
            className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/40 disabled:opacity-50"
          >
            Demote one stage
          </button>
        )}
        <Link
          href="/live-readiness"
          className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-900/40"
        >
          Live readiness →
        </Link>
      </div>

      <input
        type="text"
        value={operatorNote}
        onChange={(e) => setOperatorNote(e.target.value)}
        placeholder="Operator note (required for promote)"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200"
      />

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

      {def && (
        <Panel title="Stage requirements">
          <ul className="grid gap-1 text-xs text-zinc-300 sm:grid-cols-2">
            <li>Max notional/trade: ${def.maxNotionalPerTrade}</li>
            <li>Max daily trades: {def.maxDailyTrades}</li>
            <li>Max daily loss: ${def.maxDailyLoss}</li>
            <li>Max weekly loss: ${def.maxWeeklyLoss}</li>
            <li>Symbols: {def.allowedSymbols.join(", ") || "none"}</li>
            <li>Strategies: {def.allowedStrategies.join(", ") || "none"}</li>
            <li>Req closed trades: {def.requiredClosedTrades}</li>
            <li>Req win rate: {def.requiredWinRate}%</li>
            <li>Req max DD: {def.requiredMaxDrawdown}%</li>
            <li>Req incident-free days: {def.requiredIncidentFreeDays}</li>
          </ul>
        </Panel>
      )}

      {report && (
        <Panel title="Promotion eligibility">
          {report.promotion.blockers.length > 0 && (
            <ul className="mb-2 list-disc pl-4 text-xs text-rose-300/90">
              {report.promotion.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          <ul className="space-y-1 text-xs">
            {report.promotion.requirements.map((r) => (
              <li
                key={r.id}
                className={r.met ? "text-emerald-300/90" : "text-amber-300/90"}
              >
                {r.label}: {r.actual} / {r.required} {r.met ? "✓" : "✗"}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {report && (
        <Panel title="Demotion triggers">
          <ul className="space-y-1 text-xs">
            {report.demotionTriggers.map((t) => (
              <li
                key={t.id}
                className={t.active ? "text-rose-300/90" : "text-zinc-500"}
              >
                {t.label}: {t.message}
                {t.active && t.autoDemote ? " (auto-demote)" : ""}
              </li>
            ))}
          </ul>
          {report.shouldAutoDemote && (
            <p className="mt-2 text-xs text-rose-300">
              Auto-demotion pending → {report.autoDemoteTarget}
            </p>
          )}
        </Panel>
      )}

      {report && report.performanceByStage.length > 0 && (
        <Panel title="Live performance by stage">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead>
                <tr className="text-zinc-500">
                  <th className="py-1 pr-3">Stage</th>
                  <th className="py-1 pr-3">Closed</th>
                  <th className="py-1 pr-3">Win%</th>
                  <th className="py-1 pr-3">PnL</th>
                  <th className="py-1">Avg notional</th>
                </tr>
              </thead>
              <tbody>
                {report.performanceByStage.map((row) => (
                  <tr key={row.stage} className="border-t border-zinc-800/60">
                    <td className="py-1 pr-3">{row.label}</td>
                    <td className="py-1 pr-3">{row.closedTrades}</td>
                    <td className="py-1 pr-3">{row.winRatePct}%</td>
                    <td className="py-1 pr-3">${row.realizedPnlUsd}</td>
                    <td className="py-1">${row.avgNotionalUsd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {report && report.approvalHistory.length > 0 && (
        <Panel title="Approval history">
          <ul className="space-y-2 text-xs text-zinc-400">
            {report.approvalHistory.slice(0, 12).map((h) => (
              <li key={h.id} className="border-b border-zinc-800/50 pb-2">
                <span className="text-zinc-300">{h.action}</span>{" "}
                {h.fromStage} → {h.toStage}
                <span className="text-zinc-600"> · {h.recordedAt.slice(0, 19)}</span>
                {h.operatorNote ? (
                  <span className="block text-zinc-500">{h.operatorNote}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </OpsShell>
  );
}
