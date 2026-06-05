"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadGovernanceState, saveGovernanceState } from "@/lib/governance/governance-state";
import { loadClientRiskBudget } from "@/lib/risk-budget-optimizer/client-store";
import {
  loadLivePilotJournal,
  loadPilotEmergencyStop,
  setPilotEmergencyStop,
} from "@/lib/live-pilot/journal-store";
import type {
  LiveSupervisorReport,
  SupervisorClosePreview,
  SupervisorPositionReport,
} from "@/lib/live-trade-supervisor/types";
import { LIVE_SUPERVISOR_SAFETY_NOTICE } from "@/lib/live-trade-supervisor/types";
import {
  loadSupervisorJournal,
  logOperatorDecision,
} from "@/lib/live-trade-supervisor/supervisor-journal-store";
import type { SupervisorJournalEntry } from "@/lib/live-trade-supervisor/types";
import type { LiveMarketResponse } from "@/lib/types/market";
import { DEFAULT_SUPERVISOR_CONFIG } from "@/lib/live-trade-supervisor/types";

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

function actionClass(action: string): string {
  if (action === "CLOSE" || action === "EMERGENCY_BLOCK") return "text-rose-300";
  if (action === "REDUCE" || action === "REVIEW_REQUIRED") return "text-amber-300";
  if (action === "HEDGE") return "text-violet-300";
  return "text-emerald-300";
}

export default function LiveSupervisorDashboard() {
  const [report, setReport] = useState<LiveSupervisorReport | null>(null);
  const [selected, setSelected] = useState<SupervisorPositionReport | null>(null);
  const [closePreview, setClosePreview] = useState<SupervisorClosePreview | null>(null);
  const [journal, setJournal] = useState<SupervisorJournalEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operatorNote, setOperatorNote] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      let market = null;
      try {
        const mRes = await fetch("/api/market", { cache: "no-store" });
        if (mRes.ok) {
          const mData = (await mRes.json()) as LiveMarketResponse;
          market = mData.btc;
        }
      } catch {
        market = null;
      }

      const res = await fetch("/api/live-supervisor/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openTrades: loadLivePilotJournal(),
          entries: loadDecisionLog(),
          market,
          riskBudget: loadClientRiskBudget(),
          governance: loadGovernanceState(),
          emergencyStopActive: loadPilotEmergencyStop(),
          fetchExchange: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      const next = data.report as LiveSupervisorReport;
      setReport(next);
      setSelected(next.positions[0] ?? null);
      setJournal(loadSupervisorJournal());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Supervisor failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), DEFAULT_SUPERVISOR_CONFIG.pollIntervalHintMs);
    return () => clearInterval(id);
  }, [refresh]);

  const previewClose = async (mode: "full_close" | "partial_close") => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/live-supervisor/preview-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trade: selected.journalEntry,
          request: {
            liveTradeId: selected.liveTradeId,
            mode,
            partialPct: mode === "partial_close" ? 50 : undefined,
          },
          markPrice: selected.health.markPrice,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? res.statusText);
      setClosePreview(data.preview as SupervisorClosePreview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const logDecision = (decision: SupervisorJournalEntry["operatorDecision"]) => {
    if (!selected) return;
    const row = logOperatorDecision({
      liveTradeId: selected.liveTradeId,
      action: selected.recommendation,
      recommendationSnapshot: selected.recommendation,
      operatorDecision: decision,
      operatorNote: operatorNote || `Operator ${decision.toLowerCase()}`,
      alerts: selected.alerts.map((a) => a.message),
    });
    setJournal([row, ...loadSupervisorJournal()]);
    setOperatorNote("");
  };

  const triggerEmergency = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/live-supervisor/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorNote: operatorNote || "Supervisor emergency stop",
          triggerGovernanceKillSwitch: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? res.statusText);
      setPilotEmergencyStop(true);
      saveGovernanceState(
        {
          operatorPaused: true,
          operatorPauseReason: data.operatorNote,
          operatorPausedAt: new Date().toISOString(),
          safeMode: true,
        },
        { action: "supervisor_emergency", detail: data.operatorNote },
      );
      logOperatorDecision({
        liveTradeId: selected?.liveTradeId ?? "desk",
        action: "EMERGENCY_BLOCK",
        recommendationSnapshot: report?.aggregateRecommendation ?? "EMERGENCY_BLOCK",
        operatorDecision: "ACCEPTED",
        operatorNote: data.operatorNote,
        alerts: ["Emergency stop triggered"],
      });
      setJournal(loadSupervisorJournal());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Emergency failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OpsShell
      badge="Live Supervisor"
      title="Live Trade Supervisor"
      subtitle="Monitor open live positions — recommendations only, human approval required."
      accent="rose"
      iconLetters="LS"
      activePath="/live-supervisor"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-900/40 disabled:opacity-50"
          >
            {busy ? "Scanning…" : "Refresh"}
          </button>
          <Link
            href="/live-pilot"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Live pilot
          </Link>
        </div>
      }
    >
      <p className="mb-4 text-xs text-zinc-500">{LIVE_SUPERVISOR_SAFETY_NOTICE}</p>
      <p className="mb-4 text-xs text-zinc-600">
        Auto-refresh every {DEFAULT_SUPERVISOR_CONFIG.pollIntervalHintMs / 1000}s ·
        auto-close disabled
      </p>
      {error && (
        <p className="mb-4 rounded border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi
          label="Open positions"
          value={String(report?.openPositionCount ?? "—")}
          hint={report?.exchangeConnected ? "Exchange connected" : "Exchange offline"}
        />
        <OpsKpi
          label="Aggregate action"
          value={report?.aggregateRecommendation ?? "—"}
        />
        <OpsKpi
          label="Risk alerts"
          value={String(report?.riskAlerts.length ?? 0)}
        />
        <OpsKpi
          label="Emergency"
          value={report?.emergencyStopActive ? "STOP" : "Clear"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Open live positions">
          {report?.positions.length ? (
            <ul className="space-y-2 text-sm">
              {report.positions.map((p) => (
                <li key={p.liveTradeId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(p);
                      setClosePreview(null);
                    }}
                    className={`w-full rounded border px-3 py-2 text-left ${
                      selected?.liveTradeId === p.liveTradeId
                        ? "border-rose-700 bg-rose-950/30"
                        : "border-zinc-800 hover:bg-zinc-900/50"
                    }`}
                  >
                    <span className="font-mono text-zinc-200">{p.health.symbol}</span>{" "}
                    {p.health.side} ·{" "}
                    <span className={actionClass(p.recommendation)}>
                      {p.recommendation}
                    </span>{" "}
                    · PnL {p.health.unrealizedPnlPct}%
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">
              No open live trades in pilot journal.{" "}
              <Link href="/live-pilot" className="text-rose-300 underline">
                Live pilot
              </Link>
            </p>
          )}
        </Panel>

        <Panel title="Position health">
          {selected ? (
            <div className="space-y-1 text-xs text-zinc-400">
              <p>Health score: {selected.health.healthScore}/100</p>
              <p>
                Entry {selected.health.entryPrice.toLocaleString()} → mark{" "}
                {selected.health.markPrice.toLocaleString()}
              </p>
              <p>
                Unrealized: ${selected.health.unrealizedPnlUsd} (
                {selected.health.unrealizedPnlPct}%)
              </p>
              {selected.health.stopLoss != null && (
                <p>
                  SL {selected.health.stopLoss.toLocaleString()} · proximity{" "}
                  {selected.health.stopLossProximityPct ?? "—"}%
                </p>
              )}
              {selected.health.takeProfitReached && (
                <p className="text-emerald-300">Take profit reached</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Select a position.</p>
          )}
        </Panel>

        <Panel title="Thesis validity">
          {selected ? (
            <div className="text-xs text-zinc-400">
              <p>
                Score {selected.thesis.score}/100 ·{" "}
                {selected.thesis.valid ? "Valid" : "Invalid"}
              </p>
              <p>
                {selected.thesis.originalRegime} → {selected.thesis.currentRegime}
              </p>
              <ul className="mt-2 space-y-1">
                {selected.thesis.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">—</p>
          )}
        </Panel>

        <Panel title="Supervisor recommendation">
          {selected ? (
            <div>
              <p className={`text-lg font-semibold ${actionClass(selected.recommendation)}`}>
                {selected.recommendation}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Confidence {selected.confidence}% · human approval required
              </p>
              <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                {selected.rationale.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">—</p>
          )}
        </Panel>

        <Panel title="Risk alerts">
          {report?.riskAlerts.length ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
              {report.riskAlerts.map((a) => (
                <li
                  key={a.id}
                  className={
                    a.severity === "critical"
                      ? "text-rose-300"
                      : a.severity === "warning"
                        ? "text-amber-300"
                        : "text-zinc-400"
                  }
                >
                  [{a.category}] {a.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No alerts.</p>
          )}
        </Panel>

        <Panel title="Close / reduce preview">
          {selected && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void previewClose("partial_close")}
                  className="rounded border border-amber-800 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-100"
                >
                  Preview 50% reduce
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void previewClose("full_close")}
                  className="rounded border border-rose-800 bg-rose-950/30 px-3 py-1.5 text-xs text-rose-100"
                >
                  Preview full close
                </button>
              </div>
              {closePreview && (
                <div className="rounded border border-zinc-800 bg-zinc-900/50 p-2 text-xs text-zinc-400">
                  <p>
                    {closePreview.mode}: {closePreview.qty} @ $
                    {closePreview.estExitPrice.toLocaleString()} · $
                    {closePreview.estNotionalUsd} reduce-only
                  </p>
                  <p className="mt-1 text-zinc-500">{closePreview.disclaimer}</p>
                  <Link
                    href="/live-pilot"
                    className="mt-2 inline-block text-rose-300 underline"
                  >
                    Execute via Live Pilot (approval required)
                  </Link>
                </div>
              )}
            </div>
          )}
          {!selected && <p className="text-xs text-zinc-500">Select a position.</p>}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Operator decision">
          <textarea
            value={operatorNote}
            onChange={(e) => setOperatorNote(e.target.value)}
            placeholder="Operator note for journal…"
            className="mb-2 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => logDecision("ACCEPTED")}
              className="rounded border border-emerald-800 px-3 py-1 text-xs text-emerald-200"
            >
              Log accepted
            </button>
            <button
              type="button"
              onClick={() => logDecision("REJECTED")}
              className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300"
            >
              Log rejected
            </button>
            <button
              type="button"
              onClick={() => logDecision("DEFERRED")}
              className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300"
            >
              Defer
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void triggerEmergency()}
              className="rounded border border-rose-700 bg-rose-950/50 px-3 py-1 text-xs text-rose-200"
            >
              Emergency stop
            </button>
          </div>
        </Panel>

        <Panel title="Supervisor journal">
          {journal.length ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-[11px] text-zinc-500">
              {journal.slice(0, 12).map((j) => (
                <li key={j.id}>
                  {new Date(j.timestamp).toLocaleString()} · {j.liveTradeId.slice(0, 8)} ·{" "}
                  {j.action} → {j.operatorDecision}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">Decisions log here after operator action.</p>
          )}
        </Panel>
      </div>
    </OpsShell>
  );
}
