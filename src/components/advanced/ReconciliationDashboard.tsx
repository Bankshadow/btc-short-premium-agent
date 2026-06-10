"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import GoalShell from "@/components/goal/GoalShell";
import type {
  CombinedEngineStatusSnapshot,
  ConsistencyAutoFixId,
  ConsistencyIssue,
  EngineConsistencySnapshot,
} from "@/lib/engine-consistency/types";
import type { EngineHealthSnapshot } from "@/lib/analysis-engine-health/types";

const STATUS_CLASS = {
  OK: "border-emerald-900/50 bg-emerald-950/25 text-emerald-100",
  WARNING: "border-amber-900/50 bg-amber-950/25 text-amber-100",
  BLOCKED: "border-rose-900/50 bg-rose-950/25 text-rose-100",
};

function IssueRow({ issue }: { issue: ConsistencyIssue }) {
  return (
    <li className="rounded-lg border border-zinc-800/80 px-3 py-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <span className="font-medium text-zinc-200">{issue.kind.replace(/_/g, " ")}</span>
        <span
          className={
            issue.severity === "BLOCKED" ? "text-rose-300" : "text-amber-300"
          }
        >
          {issue.severity}
        </span>
        <span className="text-zinc-500">{issue.source}</span>
      </div>
      <p className="mt-1 text-zinc-300">{issue.message}</p>
      {issue.requiredManualAction && (
        <p className="mt-1 text-amber-200/80">Manual: {issue.requiredManualAction}</p>
      )}
    </li>
  );
}

export default function ReconciliationDashboard() {
  const [snapshot, setSnapshot] = useState<EngineConsistencySnapshot | null>(null);
  const [health, setHealth] = useState<EngineHealthSnapshot | null>(null);
  const [combined, setCombined] = useState<CombinedEngineStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [fixMessage, setFixMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [consistencyRes, healthRes] = await Promise.all([
        fetch("/api/analysis/consistency", { cache: "no-store" }),
        fetch("/api/analysis/health", { cache: "no-store" }),
      ]);
      const consistencyData = (await consistencyRes.json()) as {
        ok: boolean;
        snapshot?: EngineConsistencySnapshot;
        combined?: CombinedEngineStatusSnapshot;
      };
      const healthData = (await healthRes.json()) as {
        ok: boolean;
        snapshot?: EngineHealthSnapshot;
        combined?: CombinedEngineStatusSnapshot;
      };
      if (consistencyData.ok && consistencyData.snapshot) {
        setSnapshot(consistencyData.snapshot);
      }
      if (healthData.ok && healthData.snapshot) setHealth(healthData.snapshot);
      setCombined(consistencyData.combined ?? healthData.combined ?? null);
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAutoFix = async (actions?: ConsistencyAutoFixId[]) => {
    setFixing(true);
    setFixMessage(null);
    try {
      const res = await fetch("/api/analysis/consistency/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          actions ? { actions } : { applyRecommended: true },
        ),
      });
      const data = (await res.json()) as {
        ok: boolean;
        result?: { applied: string[]; errors: string[]; tradesOpened: false };
        error?: string;
      };
      if (data.ok && data.result) {
        setFixMessage(
          `Applied: ${data.result.applied.join(", ") || "none"}. Trades opened: no.`,
        );
        await refresh();
      } else {
        setFixMessage(data.error ?? "Auto-fix failed");
      }
    } catch (err) {
      setFixMessage(err instanceof Error ? err.message : "Auto-fix failed");
    } finally {
      setFixing(false);
    }
  };

  const summary = combined?.summary ?? snapshot?.consistencyStatus ?? "WARNING";

  return (
    <GoalShell
      title="Reconciliation"
      subtitle="Cross-store consistency between analysis engine, mission snapshot, journals, and testnet."
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

      {snapshot && (
        <>
          <section className={`rounded-xl border p-5 ${STATUS_CLASS[summary]}`}>
            <p className="text-xs uppercase tracking-wide opacity-80">Consistency status</p>
            <h2 className="mt-1 text-2xl font-semibold">{snapshot.consistencyLabel}</h2>
            {combined && (
              <p className="mt-2 text-sm opacity-90">
                Combined engine status: {combined.summaryLabel}
                {combined.positionStateUncertain && " · position state uncertain"}
              </p>
            )}
            {snapshot.blocksNewTrades && (
              <p className="mt-2 text-sm font-medium">
                New trades blocked until reconciliation completes.
              </p>
            )}
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs text-zinc-400">
            <div className="rounded-lg border border-zinc-800/80 p-3">
              <p className="text-zinc-500">Decision log</p>
              <p className="font-mono text-zinc-200">{snapshot.storeSummary.decisionLogCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-800/80 p-3">
              <p className="text-zinc-500">Trade journal</p>
              <p className="font-mono text-zinc-200">{snapshot.storeSummary.tradeJournalCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-800/80 p-3">
              <p className="text-zinc-500">Binance open</p>
              <p className="font-mono text-zinc-200">
                {snapshot.storeSummary.binanceOpenPositions}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800/80 p-3">
              <p className="text-zinc-500">Mission vs trades PnL</p>
              <p className="font-mono text-zinc-200">
                {snapshot.storeSummary.missionNetPnl.toFixed(2)} /{" "}
                {snapshot.storeSummary.dashboardNetPnl.toFixed(2)}
              </p>
            </div>
          </section>

          {snapshot.autoFixAvailable && (
            <section className="mt-4 rounded-xl border border-violet-900/40 bg-violet-950/15 p-4">
              <h3 className="text-xs font-semibold uppercase text-violet-300">
                Auto-fix available
              </h3>
              <p className="mt-1 text-xs text-zinc-400">
                Safe fixes only — journal reconcile, ledger backfill for existing exchange
                positions, learning sync, mission refresh. Never opens trades.
              </p>
              <ul className="mt-2 text-xs text-zinc-500">
                {snapshot.autoFixActions.map((a) => (
                  <li key={a}>• {a.replace(/_/g, " ")}</li>
                ))}
              </ul>
              <button
                type="button"
                disabled={fixing}
                onClick={() => void runAutoFix()}
                className="mt-3 rounded-lg border border-violet-700/50 px-3 py-2 text-xs text-violet-200 hover:bg-violet-950/40 disabled:opacity-50"
              >
                {fixing ? "Applying…" : "Apply recommended fixes"}
              </button>
              {fixMessage && <p className="mt-2 text-xs text-zinc-400">{fixMessage}</p>}
            </section>
          )}

          {snapshot.requiredManualActions.length > 0 && (
            <section className="mt-4 rounded-xl border border-amber-900/40 bg-amber-950/15 p-4">
              <h3 className="text-xs font-semibold uppercase text-amber-300">
                Required manual action
              </h3>
              <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
                {snapshot.requiredManualActions.map((a) => (
                  <li key={a}>• {a}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Issues ({snapshot.issues.length})
            </h3>
            {snapshot.issues.length === 0 ? (
              <p className="mt-2 text-sm text-emerald-300/90">All stores consistent.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {snapshot.issues.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} />
                ))}
              </ul>
            )}
          </section>

          {health && (
            <section className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
              <h3 className="text-xs font-semibold uppercase text-zinc-400">
                Engine health (inputs)
              </h3>
              <p className="mt-2 text-sm text-zinc-300">{health.summaryLabel}</p>
              <Link
                href="/advanced/engine-health"
                className="mt-2 inline-block text-xs text-emerald-300 hover:underline"
              >
                Full health checks →
              </Link>
            </section>
          )}
        </>
      )}

      {loading && !snapshot && (
        <p className="text-sm text-zinc-500">Running consistency checks…</p>
      )}
    </GoalShell>
  );
}
