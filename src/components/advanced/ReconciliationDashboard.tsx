"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import GoalShell from "@/components/goal/GoalShell";
import type { ReconciliationStatusResponse } from "@/lib/testnet-engine-activation/types";

const STATUS_CLASS = {
  OK: "border-emerald-900/50 bg-emerald-950/25 text-emerald-100",
  WARNING: "border-amber-900/50 bg-amber-950/25 text-amber-100",
  BLOCKED: "border-rose-900/50 bg-rose-950/25 text-rose-100",
};

export default function ReconciliationDashboard() {
  const [status, setStatus] = useState<ReconciliationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reconciliation/status", { cache: "no-store" });
      const data = (await res.json()) as ReconciliationStatusResponse & {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || data.ok === false) {
        throw new Error(data.error ?? "Reconciliation check failed");
      }
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconciliation check failed");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = status?.status ?? "WARNING";

  return (
    <GoalShell
      title="Reconciliation"
      subtitle="Cross-store consistency — MVP 95 lightweight status."
      activePath="/advanced/reconciliation"
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/advanced" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Advanced
        </Link>
        <Link
          href="/advanced/engine-health"
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Engine health →
        </Link>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <section className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 text-sm text-rose-200">
          {error}
        </section>
      )}

      {status && (
        <>
          <section className={`rounded-xl border p-5 ${STATUS_CLASS[summary]}`}>
            <p className="text-xs uppercase tracking-wide opacity-80">Consistency status</p>
            <h2 className="mt-1 text-2xl font-semibold">{status.status}</h2>
            <p className="mt-2 text-sm opacity-90">{status.message}</p>
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs text-zinc-400">
            {[
              ["Closed missing PnL", status.closedTradeMissingPnl],
              ["Journal missing decision", status.journalMissingDecision],
              ["Decision missing journal", status.decisionMissingJournal],
              ["Binance pos / no local", status.binancePositionMissingLocalTrade],
              ["Local open / no Binance", status.localOpenTradeMissingBinancePosition],
              ["Learning missing", status.learningMissingForClosedTrade],
            ].map(([label, count]) => (
              <div key={label as string} className="rounded-lg border border-zinc-800/80 p-3">
                <p className="text-zinc-500">{label as string}</p>
                <p className="font-mono text-zinc-200">{count as number}</p>
              </div>
            ))}
          </section>

          {status.autoFixAvailable && (
            <p className="mt-4 text-xs text-violet-300">
              Auto-fix available — use legacy{" "}
              <Link href="/api/analysis/consistency/fix" className="underline">
                consistency fix API
              </Link>{" "}
              from operator tools.
            </p>
          )}

          {status.requiredManualAction && (
            <section className="mt-4 rounded-xl border border-amber-900/40 bg-amber-950/15 p-4">
              <h3 className="text-xs font-semibold uppercase text-amber-300">
                Required manual action
              </h3>
              <p className="mt-2 text-xs text-amber-100/90">{status.requiredManualAction}</p>
            </section>
          )}
        </>
      )}

      {!status && !error && loading && (
        <p className="text-sm text-zinc-500">Running consistency checks…</p>
      )}

      {!status && !error && !loading && (
        <p className="text-sm text-zinc-500">No reconciliation data — try Refresh.</p>
      )}
    </GoalShell>
  );
}
