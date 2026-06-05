"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import type { PerpDirectionalSignal } from "@/lib/multi-asset/types";
import type { OrderPreviewResult } from "@/lib/exchange/types";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { runEvaluationFromLivePilotClose } from "@/lib/self-learning/run-evaluation";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { buildLiveReadinessReport } from "@/lib/live-readiness/build-readiness-report";
import { loadClientRiskBudget } from "@/lib/risk-budget-optimizer/client-store";
import type { ServerReadinessContext } from "@/lib/live-readiness/types";
import {
  appendLivePilotJournal,
  loadLivePilotJournal,
  loadPilotEmergencyStop,
  loadPilotPreviewQueue,
  savePilotPreviewQueue,
  setPilotEmergencyStop,
  updateLivePilotJournalEntry,
} from "@/lib/live-pilot/journal-store";
import type {
  LiveTradeJournalEntry,
  PilotPreviewQueueItem,
  PilotStatusSnapshot,
} from "@/lib/live-pilot/types";

function modeColor(mode: string): string {
  if (mode === "LIVE_SMALL_PILOT") return "text-emerald-300";
  if (mode === "LIVE_TESTNET") return "text-cyan-300";
  if (mode === "LIVE_DISABLED") return "text-zinc-400";
  return "text-rose-300";
}

export default function LivePilotDashboard() {
  const [status, setStatus] = useState<PilotStatusSnapshot | null>(null);
  const [journal, setJournal] = useState<LiveTradeJournalEntry[]>([]);
  const [queue, setQueue] = useState<PilotPreviewQueueItem[]>([]);
  const [signals, setSignals] = useState<PerpDirectionalSignal[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [readinessStatus, setReadinessStatus] = useState<
    "PASS" | "WARNING" | "FAIL"
  >("FAIL");
  const [approveNotes, setApproveNotes] = useState<Record<string, string>>({});
  const [doubleConfirm, setDoubleConfirm] = useState<Record<string, boolean>>({});

  const clientPayload = useCallback(() => {
    const entries = loadDecisionLog();
    const orders = loadPaperOrders();
    return {
      entries,
      orders,
      governance: loadGovernanceState(),
      incidents: loadIncidents(),
      journal: loadLivePilotJournal(),
      emergencyStopActive: loadPilotEmergencyStop(),
    };
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    const payload = clientPayload();
    setJournal(payload.journal);
    setEmergencyStop(payload.emergencyStopActive);
    setQueue(loadPilotPreviewQueue());

    try {
      const [statusRes, readinessRes, scanRes] = await Promise.all([
        fetch("/api/live-pilot/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            journal: payload.journal,
            emergencyStopActive: payload.emergencyStopActive,
          }),
        }),
        fetch("/api/live-readiness"),
        fetch("/api/multi-asset/scan"),
      ]);

      const statusData = await statusRes.json();
      if (!statusRes.ok) throw new Error(statusData.error ?? "Status failed");
      setStatus(statusData.status as PilotStatusSnapshot);

      const readinessData = await readinessRes.json();
      if (readinessRes.ok && readinessData.serverContext) {
        const report = buildLiveReadinessReport({
          ...payload,
          riskProfile: "balanced",
          serverContext: readinessData.serverContext as ServerReadinessContext,
        });
        setReadinessStatus(report.overallStatus);
      }

      const scanData = await scanRes.json();
      if (scanRes.ok) {
        setSignals(
          (scanData.signals as PerpDirectionalSignal[]).filter(
            (s) => s.actionable && s.direction !== "FLAT",
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }, [clientPayload]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const queuePreview = async (signal: PerpDirectionalSignal) => {
    setBusy(true);
    setError(null);
    const payload = clientPayload();
    try {
      const res = await fetch("/api/live-pilot/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          signal,
          sourceSignalId: `${signal.assetId}-${signal.direction}`,
          readinessStatus,
          riskBudget: loadClientRiskBudget(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);

      const item: PilotPreviewQueueItem = {
        previewId: data.previewId as string,
        signal,
        preview: data.preview as OrderPreviewResult,
        sourceSignalId: `${signal.assetId}-${signal.direction}`,
        decisionLogId: null,
        createdAt: new Date().toISOString(),
        status: "QUEUED",
        operatorApprovalNote: null,
      };
      const next = [item, ...loadPilotPreviewQueue()].slice(0, 20);
      savePilotPreviewQueue(next);
      setQueue(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const executeQueued = async (item: PilotPreviewQueueItem) => {
    if (!item.preview.executeConfirmToken || !item.preview.executeConfirmExpiresAt) {
      setError("Preview missing confirm token — re-queue preview.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = clientPayload();
    try {
      const res = await fetch("/api/live-pilot/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          signal: item.signal,
          confirmToken: item.preview.executeConfirmToken,
          confirmExpiresAt: item.preview.executeConfirmExpiresAt,
          doubleConfirm: doubleConfirm[item.previewId] === true,
          operatorApproval: true,
          operatorApprovalNote: approveNotes[item.previewId] ?? "Pilot UI approval",
          previewId: item.previewId,
          sourceSignalId: item.sourceSignalId,
          decisionLogId: item.decisionLogId,
          readinessStatus,
          riskBudget: loadClientRiskBudget(),
        }),
      });
      const data = await res.json();
      if (data.journalEntry) {
        appendLivePilotJournal(data.journalEntry as LiveTradeJournalEntry);
      }
      const nextQueue: PilotPreviewQueueItem[] = loadPilotPreviewQueue().map(
        (q) =>
          q.previewId === item.previewId
            ? {
                ...q,
                status: data.ok ? ("EXECUTED" as const) : ("REJECTED" as const),
              }
            : q,
      );
      savePilotPreviewQueue(nextQueue);
      setQueue(nextQueue);
      if (!res.ok) throw new Error(data.error ?? data.pilotBlockers?.join("; ") ?? "Execute blocked");
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execute failed");
    } finally {
      setBusy(false);
    }
  };

  const closeTrade = async (trade: LiveTradeJournalEntry) => {
    if (!trade.entry) return;
    setBusy(true);
    const payload = clientPayload();
    try {
      const res = await fetch("/api/live-pilot/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          liveTradeId: trade.liveTradeId,
          symbol: trade.symbol,
          positionSide: trade.entry.side as "Buy" | "Sell",
          qty: trade.entry.qty,
          exitPrice: trade.entry.price,
          readinessStatus,
        }),
      });
      const data = await res.json();
      if (data.journalEntry) {
        updateLivePilotJournalEntry(trade.liveTradeId, data.journalEntry);
        const decisionEntry = trade.decisionLogId
          ? loadDecisionLog().find((e) => e.id === trade.decisionLogId)
          : null;
        runEvaluationFromLivePilotClose({
          journalEntry: data.journalEntry as LiveTradeJournalEntry,
          decisionEntry,
        });
      }
      if (!res.ok) throw new Error(data.error ?? "Close failed");
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Close failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleEmergencyStop = async (active: boolean) => {
    setBusy(true);
    try {
      await fetch("/api/live-pilot/emergency-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active, operatorNote: "UI emergency stop" }),
      });
      setPilotEmergencyStop(active);
      setEmergencyStop(active);
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Emergency stop failed");
    } finally {
      setBusy(false);
    }
  };

  const metrics = status?.metrics;
  const cfg = status?.config;

  return (
    <OpsShell
      badge="MVP 26 · Perp pilot"
      title="Small Live Perp Pilot"
      subtitle="Controlled tiny live perp orders — perp only, human approval, double confirm. BTC options live unavailable. Cannot enable itself."
      accent="emerald"
      iconLetters="LP"
      activePath="/live-pilot"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/live-readiness", label: "Readiness", primary: true },
        { href: "/governance", label: "Governance" },
      ]}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-lg bg-emerald-700/90 px-4 py-2 text-xs font-semibold text-zinc-100 disabled:opacity-50"
        >
          {busy ? "Syncing…" : "Refresh pilot"}
        </button>
      }
    >
      <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-2 text-xs text-emerald-200/80">
        {status?.safetyNotice ??
          "Pilot cannot enable itself. Set PILOT_ENABLED=true and LIVE_EXECUTION_ENABLED=true in server env after /live-readiness passes."}
      </p>
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {status && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OpsKpi
              label="Pilot mode"
              value={status.mode.replace(/_/g, " ")}
              hint={status.executionAllowed ? "Execution path open" : "Blocked"}
            />
            <OpsKpi
              label="Readiness"
              value={readinessStatus}
              hint="From /live-readiness"
            />
            <OpsKpi
              label="Trades today"
              value={`${metrics?.tradesToday ?? 0}/${cfg?.dailyTradeLimit ?? 0}`}
              hint="Pilot daily cap"
            />
            <OpsKpi
              label="Daily PnL"
              value={`$${metrics?.realizedPnlTodayUsd ?? 0}`}
              hint={`Limit -$${cfg?.dailyLossLimitUsd ?? 0}`}
            />
          </div>

          <p className={`text-sm font-semibold ${modeColor(status.mode)}`}>
            Mode: {status.mode} · Max notional ${status.effectiveMaxNotionalUsd} ·
            Network {cfg?.network ?? "n/a"}
          </p>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Pilot limits</h2>
            <ul className="mt-2 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
              <li>PILOT_ENABLED: {cfg?.pilotEnabled ? "true" : "false"}</li>
              <li>PILOT_MAX_NOTIONAL_USD: ${cfg?.pilotMaxNotionalUsd}</li>
              <li>LIVE_MAX_NOTIONAL_USD: ${cfg?.liveMaxNotionalUsd}</li>
              <li>Daily trades: {cfg?.dailyTradeLimit}</li>
              <li>Daily loss: ${cfg?.dailyLossLimitUsd}</li>
              <li>Weekly loss: ${cfg?.weeklyLossLimitUsd}</li>
              <li>Cooldown after loss: {cfg?.cooldownMinutesAfterLoss} min</li>
              <li>Allowed symbols: {cfg?.allowedSymbols?.join(", ") ?? "all supported perps"}</li>
            </ul>
          </section>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Daily loss meter</h2>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full ${(metrics?.dailyLossUsedPct ?? 0) >= 100 ? "bg-rose-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, metrics?.dailyLossUsedPct ?? 0)}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">
              {metrics?.dailyLossUsedPct ?? 0}% of daily loss budget used
              {metrics?.inCooldown && metrics.cooldownUntil
                ? ` · Cooldown until ${new Date(metrics.cooldownUntil).toLocaleString()}`
                : ""}
            </p>
          </section>

          <section className="desk-panel border-rose-900/50 px-5 py-4">
            <h2 className="text-sm font-semibold text-rose-300">Emergency stop</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Blocks all new pilot opens. Reduce-only closes still allowed when guards pass.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleEmergencyStop(!emergencyStop)}
              className={`mt-3 rounded-lg px-4 py-2 text-xs font-bold ${
                emergencyStop
                  ? "bg-emerald-800 text-zinc-100"
                  : "bg-rose-800 text-zinc-100"
              }`}
            >
              {emergencyStop ? "Release emergency stop" : "ACTIVATE EMERGENCY STOP"}
            </button>
          </section>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Signal → preview queue</h2>
            {signals.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No actionable perp signals.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {signals.slice(0, 5).map((s) => (
                  <li
                    key={`${s.symbol}-${s.direction}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 px-3 py-2 text-xs"
                  >
                    <span className="text-zinc-300">
                      {s.label} {s.direction} · {s.confidence}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void queuePreview(s)}
                      className="rounded bg-cyan-900/60 px-2 py-1 text-[10px] font-semibold text-cyan-200"
                    >
                      Preview for pilot
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Preview queue</h2>
            {queue.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No queued previews.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {queue.map((item) => (
                  <li
                    key={item.previewId}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-xs"
                  >
                    <div className="flex flex-wrap gap-2">
                      <span className="font-semibold text-zinc-200">
                        {item.preview.symbol} {item.preview.side}
                      </span>
                      <span
                        className={
                          item.preview.valid ? "text-emerald-400" : "text-rose-400"
                        }
                      >
                        {item.preview.valid ? "VALID" : "INVALID"}
                      </span>
                      <span className="text-zinc-500">{item.status}</span>
                    </div>
                    <p className="mt-1 text-zinc-500">
                      ${item.preview.estNotionalUsd.toFixed(2)} notional · qty{" "}
                      {item.preview.estQty}
                    </p>
                    {item.status === "QUEUED" && item.preview.valid && (
                      <>
                        <textarea
                          className="mt-2 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[10px]"
                          placeholder="Approval note"
                          value={approveNotes[item.previewId] ?? ""}
                          onChange={(e) =>
                            setApproveNotes((p) => ({
                              ...p,
                              [item.previewId]: e.target.value,
                            }))
                          }
                        />
                        <label className="mt-2 flex items-center gap-2 text-[10px] text-zinc-400">
                          <input
                            type="checkbox"
                            checked={doubleConfirm[item.previewId] === true}
                            onChange={(e) =>
                              setDoubleConfirm((p) => ({
                                ...p,
                                [item.previewId]: e.target.checked,
                              }))
                            }
                          />
                          Double confirm live execute
                        </label>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void executeQueued(item)}
                          className="mt-2 rounded bg-emerald-700/90 px-3 py-1 text-[10px] font-semibold text-zinc-100"
                        >
                          Approve & execute
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="desk-panel px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-100">Open live positions</h2>
              {journal.filter((j) => j.status === "OPEN").length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">None</p>
              ) : (
                <ul className="mt-2 space-y-2 text-xs">
                  {journal
                    .filter((j) => j.status === "OPEN")
                    .map((t) => (
                      <li
                        key={t.liveTradeId}
                        className="rounded border border-zinc-800 px-3 py-2"
                      >
                        {t.symbol} {t.side} · {t.exchangeOrderId ?? "—"}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void closeTrade(t)}
                          className="ml-2 rounded border border-amber-800/50 px-2 py-0.5 text-[10px] text-amber-200"
                        >
                          Reduce-only close
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </section>

            <section className="desk-panel px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-100">Closed live trades</h2>
              {journal.filter((j) => j.status === "CLOSED").length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">None</p>
              ) : (
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[10px] text-zinc-500">
                  {journal
                    .filter((j) => j.status === "CLOSED")
                    .map((t) => (
                      <li key={t.liveTradeId}>
                        {t.symbol} PnL ${t.realizedPnl ?? 0} · {t.closedAt?.slice(0, 16)}
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </div>

          <Link href="/live-readiness" className="text-xs text-emerald-400 hover:underline">
            Run full readiness checklist →
          </Link>
        </>
      )}
    </OpsShell>
  );
}
