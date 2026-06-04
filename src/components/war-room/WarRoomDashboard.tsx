"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell from "@/components/ops/OpsShell";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadOperatorOverrideLog } from "@/lib/governance/operator-override-log";
import {
  loadGovernanceState,
  saveGovernanceState,
} from "@/lib/governance/governance-state";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { createIncident } from "@/lib/governance/incidents-store";
import {
  EMERGENCY_PLAYBOOK_ACTIONS,
  getPlaybookAction,
  type EmergencyPlaybookActionId,
} from "@/lib/war-room/emergency-playbook";
import {
  WAR_ROOM_SCENARIOS,
  type WarRoomDrillResult,
  type WarRoomScenarioId,
} from "@/lib/war-room/scenario-types";
import type { OperatorDisciplineReport } from "@/lib/operator/types";
import type { TradeFrequencyGovernorOutput } from "@/lib/frequency/trade-frequency-governor";

export default function WarRoomDashboard() {
  const [scenarioId, setScenarioId] = useState<WarRoomScenarioId>("btc_dump_8pct");
  const [drill, setDrill] = useState<WarRoomDrillResult | null>(null);
  const [discipline, setDiscipline] = useState<OperatorDisciplineReport | null>(null);
  const [frequency, setFrequency] = useState<TradeFrequencyGovernorOutput | null>(null);
  const [gov, setGov] = useState(loadGovernanceState);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const entries = loadDecisionLog();
    const overrideLog = loadOperatorOverrideLog();

    const [discRes, freqRes, drillRes] = await Promise.all([
      fetch("/api/operator/discipline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, overrideLog }),
      }),
      fetch("/api/frequency/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      }),
      fetch("/api/war-room/run-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, entries }),
      }),
    ]);

    if (discRes.ok) setDiscipline((await discRes.json()) as OperatorDisciplineReport);
    if (freqRes.ok) setFrequency((await freqRes.json()) as TradeFrequencyGovernorOutput);
    if (drillRes.ok) {
      const d = (await drillRes.json()) as { drill: WarRoomDrillResult };
      setDrill(d.drill);
    }
    setGov(loadGovernanceState());
  }, [scenarioId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runDrill = async () => {
    setBusy(true);
    await refresh();
    setBusy(false);
  };

  const applyPlaybook = (actionId: EmergencyPlaybookActionId) => {
    const action = getPlaybookAction(actionId);
    if (!action) return;

    if (actionId === "create_incident") {
      createIncident({
        type: "other",
        severity: "high",
        description: `War room drill: ${drill?.title ?? scenarioId}`,
        rootCause: drill?.emergencyAction ?? "",
        correctiveAction: drill?.operatorChecklist[0] ?? "",
      });
      setStatus("Incident logged.");
      return;
    }

    const next = saveGovernanceState(action.patch, {
      action: action.auditAction,
      detail: action.label,
    });
    setGov(next);
    setStatus(`${action.label} applied (analysis/paper modes only).`);
  };

  const incidents = loadIncidents().slice(0, 6);

  return (
    <OpsShell
      badge="MVP 20 · Crisis mode"
      title="War Room & Operator Discipline"
      subtitle="Scenario drills, emergency playbook, override analytics, and trade frequency governor. Cannot place exchange orders."
      accent="rose"
      iconLetters="WR"
      activePath="/war-room"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/governance", label: "Governance", primary: true },
        { href: "/simulation", label: "Simulation" },
        { href: "/incidents", label: "Incidents" },
      ]}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void runDrill()}
          className="rounded-lg bg-rose-800/90 px-4 py-2 text-xs font-semibold text-zinc-100 disabled:opacity-50"
        >
          {busy ? "Drill running…" : "Run scenario drill"}
        </button>
      }
    >
      {status && (
        <p className="rounded border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          {status}
        </p>
      )}

      <section className="desk-panel px-5 py-4">
        <h2 className="desk-section-title">Operator discipline score</h2>
        {discipline ? (
          <div className="mt-3 flex flex-wrap items-baseline gap-4">
            <p className="text-4xl font-bold text-zinc-100">
              {discipline.operatorDisciplineScore}
              <span className="ml-2 text-lg text-zinc-500">/ 100 · {discipline.grade}</span>
            </p>
            <p className="text-xs text-zinc-500">
              Overrides {discipline.overrideCount} · win rate {discipline.overrideWinRate}% ·
              loss impact {discipline.overrideLossImpactR}R
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-600">Loading…</p>
        )}
        {discipline?.emotionalTradingWarnings.map((w) => (
          <p key={w} className="mt-2 text-xs text-amber-300/90">
            {w}
          </p>
        ))}
        {discipline?.requireStrongerConfirmation && (
          <p className="mt-2 text-xs font-semibold text-rose-300">
            Stronger confirmation required for overrides.
          </p>
        )}
      </section>

      <section className="desk-panel px-5 py-4">
        <h2 className="desk-section-title">Trade frequency governor</h2>
        {frequency && (
          <p className="mt-2 text-sm text-zinc-300">
            {frequency.frequencyAllowed ? (
              <span className="text-emerald-400">Signals allowed</span>
            ) : (
              <span className="text-rose-400">Blocked — {frequency.reason}</span>
            )}
            {" · "}
            Remaining today: {frequency.remainingSignalsToday} trade /{" "}
            {frequency.remainingFuturesToday} futures
            {frequency.cooldownUntil && (
              <span className="block font-mono text-[10px] text-zinc-600">
                Cooldown until {frequency.cooldownUntil.slice(0, 19)}
              </span>
            )}
          </p>
        )}
      </section>

      <section className="desk-panel px-5 py-4">
        <h2 className="desk-section-title">Scenario drill</h2>
        <select
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value as WarRoomScenarioId)}
          className="mt-2 w-full max-w-md rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
        >
          {WAR_ROOM_SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        {drill && (
          <div className="mt-4 space-y-3 text-[11px]">
            <p className="text-sm font-medium text-rose-200/90">{drill.emergencyAction}</p>
            <p className="text-zinc-500">
              Committee: {drill.committeeRecommendation} · Risk veto:{" "}
              {drill.riskManagerVeto ? "yes" : "no"} · Conflict {drill.conflictLevel} ·
              Data trust {drill.dataTrustGrade}
            </p>
            {drill.strategiesToDisable.length > 0 && (
              <p>Disable: {drill.strategiesToDisable.join(", ")}</p>
            )}
            <ul className="list-inside list-disc text-zinc-600">
              {drill.operatorChecklist.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="desk-panel px-5 py-4">
        <h2 className="desk-section-title">Emergency playbook</h2>
        <p className="mt-1 text-[10px] text-zinc-600">
          Safe mode: {gov.safeMode ? "ON" : "off"} · Aggressive disabled:{" "}
          {gov.disableAggressiveMode ? "yes" : "no"} · Paper auto-open paused:{" "}
          {gov.pausePaperAutoOpen ? "yes" : "no"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EMERGENCY_PLAYBOOK_ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => applyPlaybook(a.id)}
              className="rounded border border-rose-900/50 bg-rose-950/30 px-3 py-1.5 text-[10px] text-rose-200/90 hover:bg-rose-900/40"
            >
              {a.label}
            </button>
          ))}
        </div>
      </section>

      <section className="desk-panel px-5 py-4">
        <h2 className="desk-section-title">Incident candidate log</h2>
        <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
          {incidents.length === 0 ? (
            <li>No incidents — drills may create via playbook.</li>
          ) : (
            incidents.map((i) => (
              <li key={i.id}>
                {i.severity} · {i.type} · {i.description.slice(0, 60)}
              </li>
            ))
          )}
        </ul>
        <Link href="/incidents" className="mt-2 inline-block text-xs text-rose-400 hover:underline">
          Open incidents →
        </Link>
      </section>
    </OpsShell>
  );
}
