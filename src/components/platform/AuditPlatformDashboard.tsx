"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { POLICY_ACTION_LABELS } from "@/lib/policy-engine/config";
import type { PolicyDecisionRecord } from "@/lib/policy-engine/types";
import { loadClientPolicyDecisions } from "@/lib/policy-engine/audit-store";

function decisionTone(d: string): string {
  if (d === "ALLOW") return "text-emerald-300";
  if (d === "BLOCK") return "text-rose-300";
  return "text-amber-300";
}

export default function AuditPlatformDashboard() {
  const [recent, setRecent] = useState<PolicyDecisionRecord[]>([]);
  const [blocked, setBlocked] = useState<PolicyDecisionRecord[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/policies/decisions?limit=30");
      const data = (await res.json()) as {
        ok: boolean;
        recent?: PolicyDecisionRecord[];
        blocked?: PolicyDecisionRecord[];
      };
      if (data.ok) {
        setRecent(data.recent ?? []);
        setBlocked(data.blocked ?? []);
      }
    } catch {
      setRecent(loadClientPolicyDecisions());
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <OpsShell
      badge="P-MVP 6 · Platform audit"
      title="Audit"
      subtitle="Policy decisions and governance trail — who was blocked and why."
      accent="indigo"
      iconLetters="AU"
      activePath="/audit"
      nav={[
        { href: "/", label: "← Cockpit" },
        { href: "/policies", label: "Policies" },
        { href: "/ledger", label: "Ledger" },
        { href: "/governance", label: "Governance" },
      ]}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <OpsKpi label="Recent decisions" value={String(recent.length)} hint="Policy engine" />
        <OpsKpi label="Blocked" value={String(blocked.length)} hint="Safety blocks" />
        <OpsKpi label="Ledger" value="Linked" hint="Unified event trail" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="desk-panel max-h-[400px] overflow-y-auto px-4 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">Recent policy decisions</h2>
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

        <section className="desk-panel max-h-[400px] overflow-y-auto px-4 py-4">
          <h2 className="text-sm font-semibold text-rose-300">Blocked actions</h2>
          <ul className="mt-3 space-y-2">
            {blocked.length === 0 && (
              <li className="text-xs text-zinc-500">No blocked decisions in audit log.</li>
            )}
            {blocked.map((d) => (
              <li
                key={d.recordId}
                className="rounded border border-rose-900/30 px-2 py-1.5 text-[11px]"
              >
                <p className="text-rose-200">{POLICY_ACTION_LABELS[d.action]}</p>
                <p className="text-zinc-500">{d.blockers[0] ?? "Blocked"}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-xs text-zinc-500">
        Full trading audit trail and corrections are on{" "}
        <Link href="/ledger" className="text-indigo-400 hover:underline">
          Ledger
        </Link>
        . Policy rules and probes are on{" "}
        <Link href="/policies" className="text-rose-400 hover:underline">
          Policies
        </Link>
        .
      </p>
    </OpsShell>
  );
}
