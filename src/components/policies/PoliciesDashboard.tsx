"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { useWorkspace, usePermission } from "@/contexts/WorkspaceContext";
import {
  POLICY_ACTION_LABELS,
  POLICY_RULES,
} from "@/lib/policy-engine/config";
import type { PolicyActionType, PolicyDecisionRecord, PolicyRuleDefinition } from "@/lib/policy-engine/types";
import { buildPolicyInput, evaluatePolicy } from "@/lib/policy-engine";
import { appendPolicyDecision, loadClientPolicyDecisions } from "@/lib/policy-engine/audit-store";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { loadDeskBackboneInputs } from "@/lib/data-backbone/read-desk-state";

function decisionTone(d: string): string {
  if (d === "ALLOW") return "text-emerald-300";
  if (d === "REQUIRE_APPROVAL" || d === "REQUIRE_MORE_DATA") return "text-amber-300";
  return "text-rose-300";
}

const SAMPLE_ACTIONS: PolicyActionType[] = [
  "RUN_ANALYSIS",
  "CREATE_PAPER_TRADE",
  "EXECUTE_LIVE_PERP",
  "ENABLE_AUTOPILOT",
  "TRIGGER_KILL_SWITCH",
];

export default function PoliciesDashboard() {
  const { workspace, role, settings } = useWorkspace();
  const canRunAnalysis = usePermission("canRunAnalysis");
  const [recent, setRecent] = useState<PolicyDecisionRecord[]>([]);
  const [blocked, setBlocked] = useState<PolicyDecisionRecord[]>([]);
  const [rules, setRules] = useState<PolicyRuleDefinition[]>(POLICY_RULES);
  const [probeAction, setProbeAction] = useState<PolicyActionType>("RUN_ANALYSIS");
  const [probeResult, setProbeResult] = useState<ReturnType<typeof evaluatePolicy> | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/policies/decisions?limit=40");
      const data = (await res.json()) as {
        ok: boolean;
        recent?: PolicyDecisionRecord[];
        blocked?: PolicyDecisionRecord[];
        rules?: PolicyRuleDefinition[];
      };
      if (data.ok) {
        setRecent(data.recent ?? []);
        setBlocked(data.blocked ?? []);
        if (data.rules?.length) setRules(data.rules);
      }
    } catch {
      setRecent(loadClientPolicyDecisions());
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const probePolicy = () => {
    const backbone = loadDeskBackboneInputs();
    const input = buildPolicyInput({
      workspaceId: workspace.id,
      userRole: role,
      environmentMode: settings.tradingEnvironment,
      action: probeAction,
      governance: loadGovernanceState(),
      entries: backbone.entries,
      orders: backbone.orders,
      riskProfile: backbone.riskProfile,
      backboneHealthy: backbone.ledger.health.healthy,
      auditAvailable: true,
      operatorApproval: probeAction === "EXECUTE_LIVE_PERP" ? false : undefined,
    });
    const result = evaluatePolicy(input);
    void appendPolicyDecision(result, role);
    setProbeResult(result);
    void refresh();
  };

  return (
    <OpsShell
      badge="P-MVP 5 · Policy engine"
      title="Risk & Governance Policies"
      subtitle="Centralized allow/block/approval decisions — fail-closed for live."
      accent="rose"
      iconLetters="PO"
      activePath="/policies"
      nav={[
        { href: "/", label: "← Cockpit" },
        { href: "/governance", label: "Governance" },
        { href: "/command-center", label: "Command center" },
        { href: "/live-readiness", label: "Readiness" },
      ]}
    >
      <p className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-2 text-xs text-rose-200/90">
        Policy engine is fail-closed for live actions. UI cannot bypass server enforcement — API routes
        re-evaluate policy on every live execution.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi label="Policy rules" value={String(rules.length)} hint="Registered rules" />
        <OpsKpi label="Recent decisions" value={String(recent.length)} hint="Audit log" />
        <OpsKpi label="Blocked" value={String(blocked.length)} hint="BLOCK decisions" />
        <OpsKpi
          label="Your role"
          value={role}
          hint={canRunAnalysis ? "Can run analysis" : "View only"}
        />
      </div>

      <section className="desk-panel px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Probe action</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Evaluate why an action would be allowed or blocked with current desk state.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-zinc-500">
            Action
            <select
              value={probeAction}
              onChange={(e) => setProbeAction(e.target.value as PolicyActionType)}
              className="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-200"
            >
              {SAMPLE_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {POLICY_ACTION_LABELS[a]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              probePolicy();
              setBusy(false);
            }}
            className="rounded-lg bg-rose-800/70 px-3 py-1.5 text-xs text-zinc-100"
          >
            Evaluate policy
          </button>
        </div>
        {probeResult && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
            <p className={`font-semibold ${decisionTone(probeResult.decision)}`}>
              {probeResult.decision}
            </p>
            {probeResult.blockers.length > 0 && (
              <ul className="mt-2 space-y-1 text-rose-300/90">
                {probeResult.blockers.map((b) => (
                  <li key={b}>Blocker: {b}</li>
                ))}
              </ul>
            )}
            {probeResult.requiredApprovals.length > 0 && (
              <p className="mt-2 text-amber-300">
                Approvals: {probeResult.requiredApprovals.join(", ")}
              </p>
            )}
            <ul className="mt-2 space-y-1 text-zinc-500">
              {probeResult.reasons.slice(0, 4).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="desk-panel px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Policy rules</h2>
        <ul className="mt-3 space-y-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs"
            >
              <p className="font-medium text-zinc-200">
                {r.label}{" "}
                <span
                  className={
                    r.severity === "hard" ? "text-rose-400" : "text-amber-400"
                  }
                >
                  ({r.severity})
                </span>
              </p>
              <p className="text-zinc-500">{r.description}</p>
              <p className="mt-1 text-[10px] text-zinc-600">
                Applies to: {r.appliesTo.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="desk-panel max-h-[360px] overflow-y-auto px-4 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">Recent decisions</h2>
          <ul className="mt-3 space-y-2">
            {recent.length === 0 && (
              <li className="text-xs text-zinc-500">No decisions logged yet.</li>
            )}
            {recent.map((d) => (
              <li key={d.recordId} className="text-[11px] text-zinc-400">
                <span className={decisionTone(d.decision)}>{d.decision}</span> ·{" "}
                {POLICY_ACTION_LABELS[d.action]} · {d.userRole} ·{" "}
                {new Date(d.evaluatedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>

        <section className="desk-panel max-h-[360px] overflow-y-auto px-4 py-4">
          <h2 className="text-sm font-semibold text-rose-300">Blocked actions</h2>
          <ul className="mt-3 space-y-2">
            {blocked.length === 0 && (
              <li className="text-xs text-zinc-500">No blocked decisions in audit log.</li>
            )}
            {blocked.map((d) => (
              <li key={d.recordId} className="rounded border border-rose-900/30 px-2 py-1.5 text-[11px]">
                <p className="text-rose-200">{POLICY_ACTION_LABELS[d.action]}</p>
                <p className="text-zinc-500">{d.blockers[0] ?? "Blocked"}</p>
              </li>
            ))}
          </ul>
          <Link href="/actions" className="mt-3 inline-block text-[10px] text-indigo-400 hover:underline">
            Operator actions queue →
          </Link>
        </section>
      </div>
    </OpsShell>
  );
}
