"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadActionQueue } from "@/lib/autonomous-desk-manager/action-queue-store";
import { loadAutomationSettings } from "@/lib/automation/apply-automation-client";
import { applyCommandCenterClientAction } from "@/lib/command-center/apply-client-action";
import { COMMAND_CENTER_SAFETY_NOTICE } from "@/lib/command-center/types";
import type {
  CommandCenterActionType,
  CommandCenterReport,
  CommandCenterStatus,
} from "@/lib/command-center/types";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import {
  loadLivePilotJournal,
  loadPilotEmergencyStop,
} from "@/lib/live-pilot/journal-store";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { getOpenPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadClientRiskBudget } from "@/lib/risk-budget-optimizer/client-store";
import { loadAdaptationProposals } from "@/lib/strategy-adaptation/proposal-store";
import { loadExperiments } from "@/lib/strategy-experiments/experiment-store";
import { loadOptionsDryRunHistory } from "@/lib/options-dry-run/dry-run-client-store";
import { loadPersistedRegistry } from "@/lib/strategy-registry/strategy-registry-store";

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

function statusClass(status: CommandCenterStatus): string {
  if (status === "SAFE") return "text-emerald-300 border-emerald-800/50 bg-emerald-950/30";
  if (status === "CAUTION") return "text-amber-300 border-amber-800/50 bg-amber-950/30";
  if (status === "BLOCKED") return "text-rose-300 border-rose-800/50 bg-rose-950/30";
  return "text-red-200 border-red-700/60 bg-red-950/40 animate-pulse";
}

export default function CommandCenterDashboard() {
  const router = useRouter();
  const [report, setReport] = useState<CommandCenterReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operatorNote, setOperatorNote] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/command-center/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: loadDecisionLog(),
          orders: loadPaperOrders(),
          perpPositions: getOpenPerpPositions(),
          riskProfile: loadDeskSettings().riskProfile,
          governance: loadGovernanceState(),
          incidents: loadIncidents(),
          riskBudget: loadClientRiskBudget(),
          livePilotJournal: loadLivePilotJournal(),
          emergencyStopActive: loadPilotEmergencyStop(),
          deskManagerActions: loadActionQueue(),
          adaptationProposals: loadAdaptationProposals(),
          experiments: loadExperiments(),
          registry: loadPersistedRegistry(),
          automationEnabled: loadAutomationSettings().enabled,
          dryRunHistory: loadOptionsDryRunHistory(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      setReport(data.report as CommandCenterReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status refresh failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const runAction = async (action: CommandCenterActionType) => {
    setBusy(true);
    setError(null);
    setActionMsg(null);
    try {
      const res = await fetch("/api/command-center/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          operatorNote,
          reportSnapshot: report,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Action failed");

      applyCommandCenterClientAction(data);
      if (data.navigateTo) router.push(data.navigateTo);
      if (data.exportReport) {
        const blob = new Blob([data.exportReport as string], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `command-center-${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setActionMsg(data.message as string);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const p = report?.panels;

  return (
    <OpsShell
      badge="MVP 40 · Production ops"
      title="Production Trading Command Center"
      subtitle="Single-screen desk status, blockers, and emergency controls — risk reduction only."
      accent="rose"
      iconLetters="CC"
      activePath="/command-center"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/governance", label: "Governance" },
        { href: "/live-readiness", label: "Live ready", primary: true },
      ]}
    >
      <p className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-2 text-xs text-rose-200/90">
        {COMMAND_CENTER_SAFETY_NOTICE}
      </p>

      {report && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${statusClass(report.status)}`}
        >
          {report.status} — {report.statusLabel}
        </div>
      )}

      {report?.realTimeRisk && (
        <section className="rounded-xl border border-rose-900/40 bg-rose-950/15 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-rose-200">Real-time risk</h2>
            <Link
              href="/real-time-risk"
              className="text-xs text-rose-300/80 hover:text-rose-200"
            >
              Open dashboard →
            </Link>
          </div>
          <p className="mt-2 text-sm font-medium text-rose-100/90">
            {report.realTimeRisk.riskStatus}
            {report.realTimeRisk.blockNewTrades ? " — new trades blocked" : ""}
            {report.realTimeRisk.reduceOnlyMode ? " — reduce-only" : ""}
          </p>
          {report.realTimeRisk.triggeredLimits.length > 0 && (
            <p className="mt-1 text-xs text-rose-300/70">
              Limits: {report.realTimeRisk.triggeredLimits.join(", ")}
            </p>
          )}
        </section>
      )}

      {report?.optionsRisk && (
        <section className="rounded-xl border border-violet-900/40 bg-violet-950/15 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-violet-200">Options portfolio risk</h2>
            <Link
              href="/options-risk"
              className="text-xs text-violet-300/80 hover:text-violet-200"
            >
              Open dashboard →
            </Link>
          </div>
          <p className="mt-2 text-sm font-medium text-violet-100/90">
            {report.optionsRisk.overallStatus}
            {report.optionsRisk.liveReadinessBlocked ? " — live options blocked" : ""}
          </p>
          <p className="mt-1 text-xs text-violet-300/70">
            Δ {report.optionsRisk.portfolio.netDelta} · Γ {report.optionsRisk.portfolio.netGamma} ·
            Θ {report.optionsRisk.portfolio.netThetaPerDay}/day · V {report.optionsRisk.portfolio.netVega}
            {report.optionsRisk.margin.marginUsagePct != null
              ? ` · margin ${report.optionsRisk.margin.marginUsagePct}%`
              : ""}
          </p>
        </section>
      )}

      {report && report.blockers.length > 0 && (
        <section className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-4">
          <h2 className="text-sm font-semibold text-rose-200">Hard blockers</h2>
          <ul className="mt-2 space-y-1 text-xs">
            {report.blockers.map((b) => (
              <li key={b.id} className="text-rose-200/90">
                <span className="font-medium">{b.label}</span>
                <span className="text-rose-300/70"> — {b.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report && report.cautions.length > 0 && (
        <section className="rounded-lg border border-amber-900/40 bg-amber-950/15 px-4 py-3">
          <h2 className="text-xs font-semibold text-amber-300">Cautions</h2>
          <ul className="mt-1 list-disc pl-4 text-xs text-amber-200/80">
            {report.cautions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="rounded border border-rose-900/50 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}
      {actionMsg && (
        <p className="rounded border border-emerald-900/40 px-3 py-2 text-xs text-emerald-300">
          {actionMsg}
        </p>
      )}

      {p && (
        <div className="grid gap-3 sm:grid-cols-4">
          <OpsKpi
            label="Readiness"
            value={p.liveReadiness.overallStatus}
            hint={`Score ${p.liveReadiness.overallScore}`}
          />
          <OpsKpi
            label="Exchange"
            value={p.exchangeConnectivity.connected ? "UP" : "DOWN"}
            hint={p.exchangeConnectivity.network ?? "n/a"}
          />
          <OpsKpi label="Paper open" value={String(p.openPaperPositions.totalOpen)} hint="Positions" />
          <OpsKpi label="Live open" value={String(p.openLivePositions.pilotOpen)} hint="Pilot journal" />
          <OpsKpi
            label="Risk RT"
            value={report.realTimeRisk.riskStatus}
            hint={report.realTimeRisk.blockNewTrades ? "Blocked" : "OK"}
          />
          <OpsKpi
            label="Options risk"
            value={report.optionsRisk.overallStatus}
            hint={
              report.optionsRisk.greeksEstimable && report.optionsRisk.marginEstimable
                ? "Greeks OK"
                : "Greeks/margin gap"
            }
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-[180px] flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
          placeholder="Operator note (kill switch / actions)"
          value={operatorNote}
          onChange={(e) => setOperatorNote(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <Panel title="Emergency & pause actions">
        <div className="flex flex-wrap gap-2 text-xs">
          {(
            [
              ["PAUSE_ANALYSIS", "Pause analysis"],
              ["PAUSE_PAPER_TRADING", "Pause paper"],
              ["PAUSE_LIVE_PILOT", "Pause live pilot"],
              ["TRIGGER_KILL_SWITCH", "Kill switch"],
              ["REVIEW_PENDING_PROPOSAL", "Review proposals"],
              ["OPEN_LIVE_SUPERVISOR", "Live supervisor"],
              ["OPEN_INCIDENT_REPORT", "Incidents"],
              ["EXPORT_DAILY_REPORT", "Export report"],
            ] as const
          ).map(([action, label]) => (
            <button
              key={action}
              type="button"
              disabled={busy}
              onClick={() => void runAction(action)}
              className={
                action === "TRIGGER_KILL_SWITCH"
                  ? "rounded bg-rose-900/70 px-3 py-1.5 text-rose-100 hover:bg-rose-800/70 disabled:opacity-40"
                  : "rounded border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </Panel>

      {p && (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Panel title="System Health">
            <ul className="space-y-1 text-xs text-zinc-400">
              <li>Last analyze: {p.systemHealth.lastAnalyzedAt ?? "—"}</li>
              <li>Source errors: {p.systemHealth.sourceErrorCount}</li>
              <li>Automation: {p.systemHealth.automationEnabled ? "ON" : "OFF"}</li>
              <li>Pause analysis: {p.systemHealth.pauseAnalysis ? "YES" : "no"}</li>
              <li>Safe mode: {p.systemHealth.safeMode ? "YES" : "no"}</li>
            </ul>
          </Panel>

          <Panel title="Exchange Connectivity">
            <ul className="space-y-1 text-xs text-zinc-400">
              <li>Configured: {String(p.exchangeConnectivity.configured)}</li>
              <li>Connected: {String(p.exchangeConnectivity.connected)}</li>
              <li>Network: {p.exchangeConnectivity.network ?? "—"}</li>
              <li>Clock skew: {p.exchangeConnectivity.clockSkewMs ?? "—"} ms</li>
              <li>Linear pos: {p.exchangeConnectivity.linearPositionCount}</li>
              <li>Option pos: {p.exchangeConnectivity.optionPositionCount}</li>
              {p.exchangeConnectivity.error && (
                <li className="text-rose-400">{p.exchangeConnectivity.error}</li>
              )}
            </ul>
          </Panel>

          <Panel title="Live Readiness">
            <p className="text-sm font-medium text-zinc-200">
              {p.liveReadiness.overallStatus} · {p.liveReadiness.overallScore}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Pilot ready: {p.liveReadiness.readyForSmallLivePerpPilot ? "yes" : "no"}
            </p>
            <Link href="/live-readiness" className="mt-2 inline-block text-xs text-emerald-400 hover:underline">
              Open readiness →
            </Link>
          </Panel>

          <Panel title="Risk Budget">
            {p.riskBudget ? (
              <ul className="text-xs text-zinc-400">
                <li>Live allowed: {p.riskBudget.liveTradingAllowed ? "yes" : "NO"}</li>
                <li>Remaining: {p.riskBudget.riskBudgetRemainingPct}%</li>
                <li>Recommended: {p.riskBudget.recommendedRiskPct}%</li>
              </ul>
            ) : (
              <p className="text-xs text-zinc-500">No cached risk budget — run /risk-budget</p>
            )}
            <Link href="/risk-budget" className="mt-2 inline-block text-xs text-rose-400 hover:underline">
              Risk budget →
            </Link>
          </Panel>

          <Panel title="Open Paper Positions">
            <p className="text-xs text-zinc-300">
              Options {p.openPaperPositions.optionsOpen} · Perp {p.openPaperPositions.perpOpen}
            </p>
            <Link href="/portfolio" className="mt-2 inline-block text-xs text-teal-400 hover:underline">
              Portfolio →
            </Link>
          </Panel>

          <Panel title="Open Live Positions">
            <p className="text-xs text-zinc-300">
              Pilot {p.openLivePositions.pilotOpen} · Exchange linear{" "}
              {p.openLivePositions.exchangeLinearOpen}
            </p>
            <Link href="/live-pilot" className="mt-2 inline-block text-xs text-emerald-400 hover:underline">
              Live pilot →
            </Link>
          </Panel>

          <Panel title="Active AI Actions">
            <p className="text-xs text-zinc-300">
              Pending desk manager: {p.activeAiActions.pendingDeskManager}
            </p>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-zinc-500">
              {p.activeAiActions.pendingActions.map((a) => (
                <li key={a.actionId}>
                  {a.type} · {a.priority} — {a.reason.slice(0, 60)}
                </li>
              ))}
            </ul>
            <Link href="/desk-manager" className="mt-2 inline-block text-xs text-cyan-400 hover:underline">
              Desk manager →
            </Link>
          </Panel>

          <Panel title="Pending Approvals">
            <p className="text-xs text-zinc-300">{p.pendingApprovals.adaptationPending} adaptation</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-500">
              {p.pendingApprovals.adaptationProposals.map((pr) => (
                <li key={pr.proposalId}>
                  {pr.type} {pr.targetStrategy} — {pr.status}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Active Experiments">
            <p className="text-xs text-zinc-300">{p.activeExperiments.running} running</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-500">
              {p.activeExperiments.experiments.map((ex) => (
                <li key={ex.experimentId}>
                  {ex.label} · {ex.status}
                </li>
              ))}
            </ul>
            <Link href="/experiments" className="mt-2 inline-block text-xs text-violet-400 hover:underline">
              Experiments →
            </Link>
          </Panel>

          <Panel title="Strategy Registry Changes">
            <p className="text-xs text-zinc-300">{p.strategyRegistry.overrideCount} overrides</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-500">
              {p.strategyRegistry.recentChanges.map((c) => (
                <li key={`${c.strategyId}-${c.at}`}>
                  {c.strategyId} → {c.status} ({c.at.slice(0, 10)})
                </li>
              ))}
            </ul>
            <Link href="/adaptation" className="mt-2 inline-block text-xs text-indigo-400 hover:underline">
              Adaptation →
            </Link>
          </Panel>

          <Panel title="Alerts Status">
            <ul className="text-xs text-zinc-400">
              <li>Disabled: {p.alertsStatus.alertsDisabled ? "yes" : "no"}</li>
              <li>Telegram: {p.alertsStatus.telegramConfigured ? "ok" : "—"}</li>
              <li>Discord: {p.alertsStatus.discordConfigured ? "ok" : "—"}</li>
              <li>Webhook: {p.alertsStatus.deskWebhookConfigured ? "ok" : "—"}</li>
            </ul>
          </Panel>

          <Panel title="Incident Status">
            <p className="text-xs text-zinc-300">
              Open {p.incidentStatus.openCount} · Critical {p.incidentStatus.criticalOpen}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-500">
              {p.incidentStatus.incidents.map((i) => (
                <li key={i.id}>
                  [{i.severity}] {i.type} — {i.description.slice(0, 50)}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Kill Switch">
            <p className={`text-sm font-medium ${p.killSwitch.tradingPaused ? "text-rose-300" : "text-emerald-300"}`}>
              {p.killSwitch.tradingPaused ? "PAUSED" : "Clear"}
            </p>
            <ul className="mt-2 text-xs text-zinc-500">
              {p.killSwitch.messages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Panel>

          <Panel title="Daily Trading Limits">
            <ul className="text-xs text-zinc-400">
              <li>Paper daily PnL: {p.dailyTradingLimits.killSwitch.dailyPnlPct}%</li>
              <li>Pilot trades: {p.dailyTradingLimits.pilotTradesToday}/
                {p.dailyTradingLimits.pilotDailyTradeLimit}</li>
              <li>Pilot PnL today: ${p.dailyTradingLimits.pilotDailyLossUsd}</li>
              <li>Frequency: {p.dailyTradingLimits.frequency.frequencyAllowed ? "ok" : "blocked"}</li>
            </ul>
          </Panel>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs">
        <Link href="/options-testnet" className="text-cyan-400 hover:underline">
          Options testnet
        </Link>
        <Link href="/automation" className="text-cyan-400 hover:underline">
          Automation
        </Link>
        <Link href="/war-room" className="text-rose-400 hover:underline">
          War room
        </Link>
      </div>
    </OpsShell>
  );
}
