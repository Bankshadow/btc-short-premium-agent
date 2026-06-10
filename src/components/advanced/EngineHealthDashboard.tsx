"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import GoalShell from "@/components/goal/GoalShell";
import { fetchActivationStatus } from "@/lib/client/fetch-activation-status";
import type { EngineActivationHealthResponse } from "@/lib/testnet-engine-activation/types";

const SUMMARY_CLASS = {
  OK: "border-emerald-900/50 bg-emerald-950/25 text-emerald-100",
  WARNING: "border-amber-900/50 bg-amber-950/25 text-amber-100",
  BLOCKED: "border-rose-900/50 bg-rose-950/25 text-rose-100",
};

export default function EngineHealthDashboard() {
  const [health, setHealth] = useState<EngineActivationHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchActivationStatus<EngineActivationHealthResponse>(
      "/api/analysis/health",
    );
    if (result.ok) {
      setHealth(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = health?.status ?? "WARNING";

  return (
    <GoalShell
      title="Engine Health"
      subtitle="Central analysis engine inputs — MVP 95 activation health (≤5s)."
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

      {health && (
        <>
          <section className={`rounded-xl border p-5 ${SUMMARY_CLASS[summary]}`}>
            <p className="text-xs uppercase tracking-wide opacity-80">Engine health</p>
            <h2 className="mt-1 text-2xl font-semibold">{health.status}</h2>
            <p className="mt-2 text-sm opacity-90">
              {health.blockers.length > 0
                ? health.blockers[0]
                : health.warnings.length > 0
                  ? health.warnings[0]
                  : "All activation checks passed."}
            </p>
            <p className="mt-2 text-xs opacity-70">
              Updated {new Date(health.updatedAt).toLocaleString()} · {health.checks.length}{" "}
              checks · live locked
            </p>
          </section>

          {health.blockers.length > 0 && (
            <section className="mt-4 rounded-xl border border-rose-900/40 bg-rose-950/15 p-4">
              <h3 className="text-xs font-semibold uppercase text-rose-300">Blockers</h3>
              <ul className="mt-2 space-y-1 text-xs text-rose-100/90">
                {health.blockers.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Activation checks
            </h2>
            <ul className="mt-3 space-y-2">
              {health.checks.map((check) => (
                <li
                  key={check.id}
                  className="rounded-lg border border-zinc-800/80 px-3 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-100">{check.name}</span>
                    <span className="text-[10px] uppercase text-zinc-500">{check.status}</span>
                  </div>
                  <p className="mt-1 text-zinc-300">{check.reason}</p>
                  {check.lastCheckedAt && (
                    <p className="mt-1 text-[10px] text-zinc-500">
                      Last checked: {new Date(check.lastCheckedAt).toLocaleString()}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {!health && !error && loading && (
        <p className="text-sm text-zinc-500">Running engine health checks…</p>
      )}

      {!health && !error && !loading && (
        <section className="rounded-xl border border-zinc-800/80 p-5 text-sm text-zinc-400">
          <p className="font-medium text-zinc-200">Zero-state</p>
          <p className="mt-2">No health data yet — run Start AI or Refresh.</p>
        </section>
      )}
    </GoalShell>
  );
}
