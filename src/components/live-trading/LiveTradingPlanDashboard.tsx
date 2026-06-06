"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { buildCommandCenterReport } from "@/lib/command-center/evaluate-status";
import type { CommandCenterInput } from "@/lib/command-center/types";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { loadOperatorOverrideLog } from "@/lib/governance/operator-override-log";
import { loadBacktestReadinessBridge } from "@/lib/historical-backtest/client-bridge";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { buildLiveReadinessReport } from "@/lib/live-readiness/build-readiness-report";
import type { ServerReadinessContext } from "@/lib/live-readiness/types";
import {
  buildLiveTradingPlanReport,
  loadLatestAnalyzeCache,
  type LiveTradingPlanReport,
  type PhaseStatus,
} from "@/lib/live-trading-readiness";
import { isKillSwitchTested } from "@/lib/live-trading-readiness/operational-gates";
import { PAPER_OUTCOME_DOWNSTREAM } from "@/lib/live-trading-readiness/paper-validation";
import { loadClientApprovalHistory, loadClientScaleStage } from "@/lib/live-scale-up/scale-client-store";
import {
  loadLivePilotJournal,
  loadPilotEmergencyStop,
} from "@/lib/live-pilot/journal-store";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadClientRiskBudget } from "@/lib/risk-budget-optimizer/client-store";
import { enrichRealTimeRiskInput } from "@/lib/real-time-risk/build-server-context";
import { evaluateRealTimeRisk } from "@/lib/real-time-risk/evaluate-realtime-risk";
import { loadOptionsDryRunHistory } from "@/lib/options-dry-run/dry-run-client-store";
import { buildOptionsRiskReport } from "@/lib/options-risk-greeks/build-options-risk-report";

function phaseStyles(status: PhaseStatus): string {
  if (status === "READY") return "bg-emerald-900/40 text-emerald-200 ring-emerald-700/40";
  if (status === "IN_PROGRESS") return "bg-amber-900/40 text-amber-200 ring-amber-700/40";
  if (status === "BLOCKED") return "bg-rose-900/40 text-rose-200 ring-rose-700/40";
  return "bg-zinc-800/60 text-zinc-400 ring-zinc-700/40";
}

export default function LiveTradingPlanDashboard() {
  const [report, setReport] = useState<LiveTradingPlanReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const entries = loadDecisionLog();
      const orders = loadPaperOrders();
      const deskSettings = loadDeskSettings();
      const latestAnalysis = loadLatestAnalyzeCache();
      const governance = loadGovernanceState();
      const journal = loadLivePilotJournal();
      const emergencyStopActive = loadPilotEmergencyStop();
      const incidents = loadIncidents();

      const readinessRes = await fetch("/api/live-readiness");
      const readinessData = await readinessRes.json();
      if (!readinessRes.ok) throw new Error(readinessData.error ?? "Readiness failed");
      const serverContext = readinessData.serverContext as ServerReadinessContext;

      const pilotRes = await fetch("/api/live-pilot/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journal, emergencyStopActive }),
      });
      const pilotData = await pilotRes.json();
      const pilotMode = pilotData.status?.mode ?? "LIVE_DISABLED";

      const readinessInput = {
        entries,
        orders,
        perpPositions: loadPerpPositions(),
        riskProfile: deskSettings.riskProfile,
        governance,
        incidents,
        overrideLog: loadOperatorOverrideLog(),
        deskSettings,
        latestAnalysis,
        backtestBridge: loadBacktestReadinessBridge(),
        riskBudget: loadClientRiskBudget(),
        serverContext,
        commandCenterStatus: null as string | null,
        realTimeRiskStatus: null as string | null,
        killSwitchTested: isKillSwitchTested(),
        auditEnabled: deskSettings.auditLiveActions,
      };

      const commandCenterInput: CommandCenterInput = {
        entries,
        orders,
        perpPositions: loadPerpPositions(),
        riskProfile: deskSettings.riskProfile,
        governance,
        incidents,
        latestAnalysis,
        riskBudget: loadClientRiskBudget(),
        livePilotJournal: journal,
        emergencyStopActive,
        serverContext,
      };

      const commandCenter = buildCommandCenterReport(commandCenterInput);
      readinessInput.commandCenterStatus = commandCenter.status;

      const riskInput = await enrichRealTimeRiskInput({
        entries,
        orders,
        perpPositions: loadPerpPositions(),
        liveTrades: journal,
        governance,
        incidents,
        riskBudget: loadClientRiskBudget(),
        emergencyStopActive,
        market: latestAnalysis,
        commandCenter,
      });
      const realTimeRisk = evaluateRealTimeRisk(riskInput);
      readinessInput.realTimeRiskStatus = realTimeRisk.riskStatus;

      const liveReadiness = buildLiveReadinessReport(readinessInput);

      const plan = buildLiveTradingPlanReport({
        readinessInput,
        commandCenterInput,
        realTimeRiskInput: riskInput,
        scaleUpInput: {
          currentStage: loadClientScaleStage(),
          journal,
          incidents,
          readiness: liveReadiness,
          realTimeRisk,
          commandCenter,
          governance,
          emergencyStopActive,
          exchangeStatus: serverContext.exchangeStatus,
          approvalHistory: loadClientApprovalHistory(),
          entries,
        },
        optionsDryRunHistory: loadOptionsDryRunHistory(),
        optionsRiskReport: buildOptionsRiskReport({
          paperOrders: orders,
          spotPrice: latestAnalysis?.step1_marketSnapshot.spotPrice ?? null,
        }),
        pilotMode,
        auditEnabled: deskSettings.auditLiveActions,
        alertsGovernanceOff: governance.disableAlerts,
      });

      setReport(plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan refresh failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <OpsShell
      badge="Live Trading Readiness Plan"
      title="Staged path to live"
      subtitle="Paper → readiness → micro perp pilot → scale-up. Options live remains disabled."
      accent="rose"
      iconLetters="LT"
      activePath="/live-trading"
      nav={[
        { href: "/", label: "← Cockpit" },
        { href: "/live-readiness", label: "Readiness" },
        { href: "/live-pilot", label: "Pilot", primary: true },
        { href: "/live-scale-up", label: "Scale-up" },
        { href: "/options-live-readiness", label: "Options prep" },
      ]}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-lg border border-rose-800/60 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-950/40 disabled:opacity-50"
        >
          {busy ? "Refreshing…" : "Refresh plan"}
        </button>
      }
    >
      <p className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-2 text-xs text-rose-200/90">
        {report?.safetyNotice ??
          "Automatic live trading is disabled. Human approval + double confirm required for all perp live orders."}
      </p>
      {error && <p className="text-sm text-amber-400">{error}</p>}

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OpsKpi
              label="Perp micro pilot"
              value={report.perpMicroPilotAllowed ? "ALLOWED" : "BLOCKED"}
              hint="Not automatic — operator must execute"
            />
            <OpsKpi
              label="Options live"
              value="DISABLED"
              hint="Testnet prep only"
            />
            <OpsKpi
              label="Auto live trading"
              value="OFF"
              hint="By design"
            />
            <OpsKpi
              label="Next action"
              value={report.hardBlockers.length > 0 ? "Fix blockers" : "Proceed"}
              hint={report.recommendedNextAction.slice(0, 60)}
            />
          </div>

          {report.hardBlockers.length > 0 && (
            <section className="desk-panel border-rose-900/40 px-5 py-4">
              <h2 className="text-sm font-semibold text-rose-300">Hard blockers</h2>
              <ul className="mt-2 space-y-1 text-xs text-rose-200/90">
                {report.hardBlockers.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Five-phase staged path</h2>
            <ul className="mt-3 grid gap-3 lg:grid-cols-2">
              {Object.entries(report.phases).map(([key, phase]) => (
                <li
                  key={key}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-zinc-100">{phase.label}</h3>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${phaseStyles(phase.status)}`}
                    >
                      {phase.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-400">{phase.summary}</p>
                  <p className="mt-2 text-[10px] text-indigo-300/80">→ {phase.nextAction}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Operational gates</h2>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400">
              <span>Sync: {report.operationalGates.syncHealthy ? "OK" : "BLOCKED"}</span>
              <span>Audit: {report.operationalGates.auditHealthy ? "OK" : "BLOCKED"}</span>
              <span>Alerts: {report.operationalGates.alertsEnabled ? "ON" : "OFF"}</span>
              <span>Kill switch tested: {report.operationalGates.killSwitchTested ? "YES" : "NO"}</span>
              <span>Command center: {report.operationalGates.commandCenterStatus}</span>
              <span>Real-time risk: {report.operationalGates.realTimeRiskStatus}</span>
              <span>Exchange: {report.operationalGates.exchangeConnected ? "Connected" : "Disconnected"}</span>
            </div>
          </section>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Paper validation</h2>
            <p className="mt-1 text-[11px] text-zinc-500">
              Outcome resolution updates: {PAPER_OUTCOME_DOWNSTREAM.join(", ")}.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-400">
              <span>Logs: {report.paperValidation.productionDecisionLogCount}</span>
              <span>Resolved: {report.paperValidation.resolvedTrades}</span>
              <span>Pending: {report.paperValidation.pendingResolutions}</span>
              <span>Paper linked: {report.paperValidation.linkedPaperTrades}</span>
              <span>Shadow linked: {report.paperValidation.linkedShadowTrades}</span>
            </div>
            <Link href="/autopilot" className="mt-2 inline-block text-xs text-rose-400 hover:underline">
              Paper autopilot →
            </Link>
          </section>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Quick links</h2>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <Link href="/live-readiness" className="text-emerald-400 hover:underline">
                Live readiness checklist
              </Link>
              <Link href="/live-pilot" className="text-emerald-400 hover:underline">
                Micro perp pilot
              </Link>
              <Link href="/live-scale-up" className="text-emerald-400 hover:underline">
                Scale-up stages
              </Link>
              <Link href="/options-live-readiness" className="text-emerald-400 hover:underline">
                BTC options prep
              </Link>
            </div>
          </section>
        </>
      )}
    </OpsShell>
  );
}
