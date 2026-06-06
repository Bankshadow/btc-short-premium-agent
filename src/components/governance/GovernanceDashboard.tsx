"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import {
  loadGovernanceState,
  saveGovernanceState,
  setOperatorIdentity,
} from "@/lib/governance/governance-state";
import { loadGovernanceAuditLog } from "@/lib/governance/governance-audit-log";
import {
  enrichLogFromEntries,
  syncOverrideOutcomeStatuses,
} from "@/lib/governance/operator-override-log";
import {
  evaluateHardRuleLocks,
  HARD_RULE_LABELS,
} from "@/lib/governance/hard-rule-lock";
import { usePermission } from "@/contexts/WorkspaceContext";
import type { DeskUserRole } from "@/lib/governance/governance-types";
import type { WorkspaceRole } from "@/lib/platform/types";
import { evaluateKillSwitch, saveKillSwitchState } from "@/lib/validation/kill-switch";
import ExchangeStatusPanel from "./ExchangeStatusPanel";

const ROLES: WorkspaceRole[] = [
  "VIEWER",
  "TRADER",
  "RISK_MANAGER",
  "ADMIN",
  "OWNER",
];

export default function GovernanceDashboard() {
  const canKillSwitch = usePermission("canTriggerKillSwitch");
  const canChangeRisk = usePermission("canChangeRiskSettings");
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState(loadGovernanceState);

  const refresh = useCallback(() => {
    syncOverrideOutcomeStatuses();
    setState(loadGovernanceState());
    setRefreshKey((k) => k + 1);
  }, []);

  const overrideLog = useMemo(() => {
    void refreshKey;
    return enrichLogFromEntries(loadDecisionLog());
  }, [refreshKey]);

  const auditLog = useMemo(() => {
    void refreshKey;
    return loadGovernanceAuditLog();
  }, [refreshKey]);

  const hardRules = useMemo(() => {
    void refreshKey;
    return evaluateHardRuleLocks({
      entries: loadDecisionLog(),
      orders: loadPaperOrders(),
      riskProfile: loadDeskSettings().riskProfile,
    });
  }, [refreshKey]);

  const killSwitch = useMemo(() => {
    void refreshKey;
    return evaluateKillSwitch({
      entries: loadDecisionLog(),
      orders: loadPaperOrders(),
      riskProfile: loadDeskSettings().riskProfile,
      persisted: {
        operatorPaused: state.operatorPaused,
        operatorPauseReason: state.operatorPauseReason,
        operatorPausedAt: state.operatorPausedAt,
        cooldownUntil: state.cooldownUntil,
        lastTriggeredReason: null,
      },
    });
  }, [refreshKey, state]);

  const patch = (patch: Parameters<typeof saveGovernanceState>[0], action: string) => {
    if (!canChangeRisk && action !== "operator_identity") return;
    const next = saveGovernanceState(patch, { action, detail: JSON.stringify(patch) });
    setState(next);
    setRefreshKey((k) => k + 1);
  };

  const togglePauseDesk = () => {
    if (!canKillSwitch) return;
    const pause = !state.operatorPaused;
    saveKillSwitchState({
      operatorPaused: pause,
      operatorPauseReason: pause ? "Governance kill switch — pause desk" : "",
      operatorPausedAt: pause ? new Date().toISOString() : null,
      cooldownUntil: pause
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null,
    });
    patch(
      {
        operatorPaused: pause,
        operatorPauseReason: pause ? "Governance kill switch" : "",
        operatorPausedAt: pause ? new Date().toISOString() : null,
      },
      pause ? "pause_desk" : "resume_desk",
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-3 py-4 sm:px-5">
      <header className="desk-panel flex flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div>
          <p className="desk-section-title text-rose-400/90">MVP 14</p>
          <h1 className="text-lg font-semibold text-zinc-50">
            Safety, Governance & Incident Review
          </h1>
          <p className="mt-1 max-w-xl text-xs text-zinc-500">
            Semi-live ops controls — all actions logged. No real auto trading.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
            ← Desk
          </Link>
          <Link href="/incidents" className="rounded-lg border border-rose-900/50 px-3 py-1.5 text-xs text-rose-300/90 hover:bg-rose-950/40">
            Incidents
          </Link>
          <button type="button" onClick={refresh} className="rounded-lg bg-rose-900/70 px-3 py-1.5 text-xs text-zinc-100">
            Refresh
          </button>
        </div>
      </header>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title">Workspace operator identity</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Roles are managed per workspace on{" "}
          <Link href="/settings/workspace" className="text-indigo-400 hover:underline">
            /settings/workspace
          </Link>
          . Governance actions are scoped to the active workspace.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="text-xs text-zinc-500">
            Operator name
            <input
              value={state.operatorName}
              onChange={(e) => setOperatorIdentity(e.target.value, state.operatorRole)}
              onBlur={refresh}
              className="mt-1 block w-48 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
            />
          </label>
          <label className="text-xs text-zinc-500">
            Role
            <select
              value={state.operatorRole}
              onChange={(e) => {
                setOperatorIdentity(state.operatorName, e.target.value as WorkspaceRole);
                refresh();
              }}
              className="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-600">
          {ROLES.map((r) => (
            <li key={r} className="rounded bg-zinc-900 px-2 py-1">
              {r}
            </li>
          ))}
        </ul>
      </section>

      <section className="desk-panel border-rose-900/40 px-4 py-4">
        <h2 className="desk-section-title text-rose-400/90">Kill switch panel</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Trading paused: {killSwitch.tradingPaused ? "yes" : "no"} · Safe mode:{" "}
          {state.safeMode ? "ON" : "off"}
        </p>
        {!canChangeRisk && (
          <p className="mt-2 text-[10px] text-zinc-500">
            Risk settings require RISK_MANAGER, ADMIN, or OWNER role.
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={state.pauseAnalysis}
              disabled={!canChangeRisk}
              onChange={(e) =>
                patch({ pauseAnalysis: e.target.checked }, "pause_analysis")
              }
            />
            Pause all analysis
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={state.pausePaperAutoOpen}
              disabled={!canChangeRisk}
              onChange={(e) =>
                patch({ pausePaperAutoOpen: e.target.checked }, "pause_paper_auto")
              }
            />
            Pause paper auto-open
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={state.disableAggressiveMode}
              disabled={!canChangeRisk}
              onChange={(e) =>
                patch({ disableAggressiveMode: e.target.checked }, "disable_aggressive")
              }
            />
            Disable aggressive mode
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={state.disableAlerts}
              disabled={!canChangeRisk}
              onChange={(e) =>
                patch({ disableAlerts: e.target.checked }, "disable_alerts")
              }
            />
            Disable alerts
          </label>
          <label className="flex items-center gap-2 text-xs text-rose-200">
            <input
              type="checkbox"
              checked={state.safeMode}
              disabled={!canChangeRisk}
              onChange={(e) => patch({ safeMode: e.target.checked }, "safe_mode")}
            />
            Enable safe mode (force WAIT/SKIP)
          </label>
        </div>
        <button
          type="button"
          onClick={togglePauseDesk}
          disabled={!canKillSwitch}
          className="mt-4 rounded bg-rose-950 px-3 py-1.5 text-xs font-semibold text-rose-200 ring-1 ring-rose-800 disabled:opacity-40"
        >
          {state.operatorPaused ? "Resume desk (clear operator pause)" : "Pause desk trading"}
        </button>
        {!canKillSwitch && (
          <p className="mt-2 text-[10px] text-zinc-500">
            Kill switch requires RISK_MANAGER or OWNER role.
          </p>
        )}
      </section>

      <ExchangeStatusPanel />

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title">Hard rule lock</h2>
        <p className="mt-1 text-xs text-zinc-500">
          These rules cannot be overridden by operator disagree logs.
        </p>
        <ul className="mt-3 space-y-1">
          {(Object.keys(HARD_RULE_LABELS) as Array<keyof typeof HARD_RULE_LABELS>).map(
            (id) => {
              const active = hardRules.activeRules.includes(id);
              return (
                <li
                  key={id}
                  className={`text-[11px] ${active ? "text-rose-400" : "text-emerald-400/80"}`}
                >
                  {active ? "✗ LOCKED" : "✓ clear"} — {HARD_RULE_LABELS[id]}
                </li>
              );
            },
          )}
        </ul>
        {hardRules.locked && (
          <p className="mt-2 text-xs text-rose-300">
            Forced committee path: {hardRules.forcedVerdict}
          </p>
        )}
      </section>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title">Operator override log</h2>
        {overrideLog.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-600">No overrides logged yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[11px]">
              <thead className="text-zinc-500">
                <tr>
                  <th className="pb-2 pr-2">Time</th>
                  <th className="pb-2 pr-2">Original</th>
                  <th className="pb-2 pr-2">Override</th>
                  <th className="pb-2 pr-2">Veto</th>
                  <th className="pb-2 pr-2">Operator</th>
                  <th className="pb-2 pr-2">Outcome</th>
                  <th className="pb-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {overrideLog.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-800/80">
                    <td className="py-2 pr-2 font-mono text-zinc-500">
                      {row.timestamp.slice(0, 19)}
                    </td>
                    <td className="py-2 pr-2">{row.originalVerdict}</td>
                    <td className="py-2 pr-2 text-amber-300">{row.overriddenVerdict}</td>
                    <td className="py-2 pr-2">{row.riskVetoState ? "yes" : "no"}</td>
                    <td className="py-2 pr-2">
                      {row.operatorName}
                      <span className="text-zinc-600"> ({row.operatorRole})</span>
                    </td>
                    <td className="py-2 pr-2">{row.outcomeStatus}</td>
                    <td className="py-2 text-zinc-400">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title">Governance audit log</h2>
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[10px] text-zinc-500">
          {auditLog.map((a) => (
            <li key={a.id}>
              {a.timestamp.slice(0, 19)} · {a.actorRole} · {a.action} — {a.detail}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
