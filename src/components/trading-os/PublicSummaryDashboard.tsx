"use client";

import { useMemo } from "react";
import Link from "next/link";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { buildPublicPerformanceSummary } from "@/lib/trading-os/build-reports";
import { loadWorkspaceConfig } from "@/lib/trading-os/workspace-store";
import { getDeskProfile } from "@/lib/trading-os/desk-profiles";
import { ENVIRONMENT_MODE_LABELS } from "@/lib/trading-os/environment-modes";

export default function PublicSummaryDashboard() {
  const summary = useMemo(() => {
    const ws = loadWorkspaceConfig();
    const profile = getDeskProfile(ws.activeProfileId);
    return buildPublicPerformanceSummary({
      entries: loadDecisionLog(),
      orders: loadPaperOrders(),
      profileName: profile.name,
    });
  }, []);

  const ws = loadWorkspaceConfig();

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-6 px-3 py-4 sm:px-5">
      <header className="desk-panel px-4 py-4 text-center">
        <p className="desk-section-title text-zinc-500">Public view</p>
        <h1 className="text-xl font-semibold text-zinc-50">Desk performance summary</h1>
        <p className="mt-2 text-xs text-zinc-500">{summary.profileName}</p>
        <p className="mt-4 text-[10px] text-zinc-600">{summary.disclaimer}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link
            href="/"
            className="rounded-lg border border-cyan-800 bg-cyan-950/40 px-3 py-1.5 text-xs text-cyan-200"
          >
            Operator dashboard (private)
          </Link>
          <Link
            href="/workspace"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400"
          >
            Workspace
          </Link>
        </div>
      </header>

      <section className="desk-panel grid grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-3">
        <div>
          <p className="text-[10px] uppercase text-zinc-500">Sessions</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">
            {summary.totalSessions}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-zinc-500">Resolved</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">
            {summary.resolvedCount}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-zinc-500">TRADE signals</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">
            {summary.tradeSignals}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-zinc-500">Net paper PnL %</p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              summary.netPaperPnlPct >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {summary.netPaperPnlPct >= 0 ? "+" : ""}
            {summary.netPaperPnlPct}%
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-zinc-500">Open paper</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">
            {summary.openPaperCount}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-zinc-500">Mode</p>
          <p className="mt-1 text-sm text-zinc-300">
            {ENVIRONMENT_MODE_LABELS[ws.environmentMode]}
          </p>
        </div>
      </section>

      <p className="text-center text-[10px] text-zinc-600">
        Updated {new Date(summary.generatedAt).toLocaleString()} · hypothetical paper only
      </p>
    </div>
  );
}
