"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import GoalShell from "@/components/goal/GoalShell";
import type {
  EngineHealthCheck,
  EngineHealthSnapshot,
  EngineHealthStatus,
} from "@/lib/analysis-engine-health/types";

const SUMMARY_CLASS: Record<EngineHealthStatus, string> = {
  OK: "border-emerald-900/50 bg-emerald-950/25 text-emerald-100",
  WARNING: "border-amber-900/50 bg-amber-950/25 text-amber-100",
  BLOCKED: "border-rose-900/50 bg-rose-950/25 text-rose-100",
};

const CHECK_CLASS: Record<EngineHealthStatus, string> = {
  OK: "border-emerald-900/30 text-emerald-300/90",
  WARNING: "border-amber-900/30 text-amber-200/90",
  BLOCKED: "border-rose-900/30 text-rose-200/90",
};

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function CapabilityPanel({
  title,
  capability,
}: {
  title: string;
  capability: EngineHealthSnapshot["capabilities"]["analyze"];
}) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
            capability.allowed
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
              : "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25"
          }`}
        >
          {capability.allowed ? "Allowed" : "Blocked"}
        </span>
      </div>
      {capability.blockers.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-rose-200/90">
          {capability.blockers.map((b) => (
            <li key={b}>• {b}</li>
          ))}
        </ul>
      )}
      {capability.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-200/80">
          {capability.warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      )}
      {capability.blockers.length === 0 && capability.warnings.length === 0 && (
        <p className="mt-3 text-xs text-zinc-500">No blockers for this capability.</p>
      )}
    </section>
  );
}

function HealthCheckRow({ check }: { check: EngineHealthCheck }) {
  return (
    <li className={`rounded-lg border px-3 py-3 ${CHECK_CLASS[check.status]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-100">{check.label}</span>
        <span className="text-[10px] uppercase tracking-wide opacity-80">{check.status}</span>
      </div>
      <p className="mt-1 text-sm text-zinc-200">{check.message}</p>
      {check.detail && <p className="mt-1 text-xs text-zinc-500">{check.detail}</p>}
      <p className="mt-2 text-[10px] text-zinc-500">Last updated: {formatWhen(check.lastUpdatedAt)}</p>
      {(check.affectsAnalyze || check.affectsTrade || check.affectsLearn) && (
        <p className="mt-1 text-[10px] text-zinc-600">
          Affects:{" "}
          {[
            check.affectsAnalyze && "analyze",
            check.affectsTrade && "trade",
            check.affectsLearn && "learn",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </li>
  );
}

export default function EngineHealthDashboard() {
  const [snapshot, setSnapshot] = useState<EngineHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analysis/health", { cache: "no-store" });
      const data = (await res.json()) as {
        ok: boolean;
        snapshot?: EngineHealthSnapshot;
        error?: string;
      };
      if (!data.ok || !data.snapshot) {
        setError(data.error ?? "Failed to load engine health");
        setSnapshot(null);
      } else {
        setSnapshot(data.snapshot);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load engine health");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = snapshot?.summary ?? "WARNING";

  return (
    <GoalShell
      title="Engine Health"
      subtitle="Central analysis engine inputs — missing or stale modules block analyze, trade, and learn."
      activePath="/advanced/engine-health"
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/advanced" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Advanced
        </Link>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <section className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 text-sm text-rose-200">
          {error}
        </section>
      )}

      {snapshot && (
        <>
          <section className={`rounded-xl border p-5 ${SUMMARY_CLASS[summary]}`}>
            <p className="text-xs uppercase tracking-wide opacity-80">Dashboard summary</p>
            <h2 className="mt-1 text-2xl font-semibold">{snapshot.summaryLabel}</h2>
            <p className="mt-2 text-sm opacity-90">
              {snapshot.summary === "OK"
                ? "All critical inputs healthy — central engine can analyze."
                : snapshot.summary === "WARNING"
                  ? "Some inputs are stale or advisory — review before trading."
                  : "Critical inputs blocked — fix issues below before analyze/trade."}
            </p>
            <p className="mt-2 text-xs opacity-70">
              Checked {formatWhen(snapshot.generatedAt)} · {snapshot.checks.length} health checks
            </p>
          </section>

          <section className="mt-4 grid gap-3 lg:grid-cols-3">
            <CapabilityPanel title="Can analyze?" capability={snapshot.capabilities.analyze} />
            <CapabilityPanel title="Can trade?" capability={snapshot.capabilities.trade} />
            <CapabilityPanel title="Can learn?" capability={snapshot.capabilities.learn} />
          </section>

          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Input health checks
            </h2>
            <ul className="mt-3 space-y-2">
              {snapshot.checks.map((check) => (
                <HealthCheckRow key={check.id} check={check} />
              ))}
            </ul>
          </section>
        </>
      )}

      {!snapshot && !error && loading && (
        <p className="text-sm text-zinc-500">Running engine health checks…</p>
      )}
      <section className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Reconciliation
        </h2>
        <p className="mt-2 text-xs text-zinc-500">
          Cross-store consistency checks and safe auto-fix for journals and learning records.
        </p>
        <Link
          href="/advanced/reconciliation"
          className="mt-2 inline-block text-xs text-emerald-300 hover:underline"
        >
          Open reconciliation detail →
        </Link>
      </section>
    </GoalShell>
  );
}
