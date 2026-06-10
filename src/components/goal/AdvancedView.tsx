"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GoalShell from "./GoalShell";
import { GOAL_ADVANCED_MODULES } from "@/lib/ux/goal-nav-spec";
import type { CombinedEngineStatusSnapshot } from "@/lib/engine-consistency/types";

const HEALTH_SUMMARY_CLASS: Record<CombinedEngineStatusSnapshot["summary"], string> = {
  OK: "border-emerald-900/50 bg-emerald-950/20 hover:border-emerald-800/50",
  WARNING: "border-amber-900/50 bg-amber-950/20 hover:border-amber-800/50",
  BLOCKED: "border-rose-900/50 bg-rose-950/20 hover:border-rose-800/50",
};

function EngineHealthSummaryCard() {
  const [combined, setCombined] = useState<CombinedEngineStatusSnapshot | null>(null);

  useEffect(() => {
    void fetch("/api/analysis/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { ok: boolean; combined?: CombinedEngineStatusSnapshot }) => {
        if (data.ok && data.combined) setCombined(data.combined);
      })
      .catch(() => setCombined(null));
  }, []);

  if (!combined) return null;

  return (
    <Link
      href="/advanced/reconciliation"
      className={`block rounded-xl border p-4 transition ${HEALTH_SUMMARY_CLASS[combined.summary]}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-400">Engine Health</p>
          <p className="mt-1 text-lg font-semibold text-zinc-100">{combined.summaryLabel}</p>
        </div>
        <span className="text-xs text-zinc-400">Reconciliation →</span>
      </div>
      {combined.blocksNewTrades && (
        <p className="mt-2 text-xs text-rose-200/90">New trades blocked — reconcile positions.</p>
      )}
    </Link>
  );
}

export default function AdvancedView() {
  return (
    <GoalShell
      title="Advanced"
      subtitle="Power-user modules. Daily operation uses Dashboard, Trades, AI Status, Reports, and Settings."
      activePath="/advanced"
    >
      <EngineHealthSummaryCard />

      <section className="rounded-xl border border-amber-900/40 bg-amber-950/15 p-4 text-sm text-amber-100/90">
        Live trading stays locked. These modules expose registry, governance, simulation, and
        validation — not required for normal mission operation.
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {GOAL_ADVANCED_MODULES.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="block rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 transition hover:border-violet-800/50 hover:bg-zinc-900/60"
            >
              <span className="text-sm font-medium text-zinc-100">{mod.label}</span>
              <p className="mt-2 text-xs text-zinc-500">{mod.description}</p>
            </Link>
          ))}
      </div>
    </GoalShell>
  );
}
