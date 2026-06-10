"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import GoalShell from "@/components/goal/GoalShell";
import { fetchActivationStatus } from "@/lib/client/fetch-activation-status";
import type { EvidenceQualityStatusResponse } from "@/lib/testnet-engine-activation/types";

export default function EvidenceQualityDashboard() {
  const [status, setStatus] = useState<EvidenceQualityStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchActivationStatus<EvidenceQualityStatusResponse>(
      "/api/evidence-quality/status",
    );
    if (result.ok) {
      setStatus(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <GoalShell
      title="Evidence Quality"
      subtitle="Validate completed trades as usable evidence for strategy evaluation."
      activePath="/advanced/evidence-quality"
      actions={
        <button
          type="button"
          disabled={loading}
          onClick={() => void refresh()}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      }
    >
      <p className="mb-4 text-xs text-zinc-500">
        <Link href="/reports" className="text-indigo-400 hover:underline">
          Reports
        </Link>
        {" · "}
        <Link href="/advanced/reconciliation" className="text-indigo-400 hover:underline">
          Reconciliation
        </Link>
      </p>

      {error && (
        <p className="mb-4 rounded-lg border border-rose-900/50 bg-rose-950/25 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {status && (
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Evidence quality status
          </h2>
          <p className="mt-3 text-2xl font-semibold text-zinc-100">{status.status}</p>
          <p className="mt-2 text-sm text-zinc-300">{status.message}</p>
          <p className="mt-2 text-xs text-zinc-500">
            Updated {new Date(status.updatedAt).toLocaleString()} · live locked
          </p>
          <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Valid evidence</dt>
              <dd className="font-mono text-zinc-200">
                {status.validEvidenceCount}/{status.requiredEvidenceCount}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Invalid</dt>
              <dd className="font-mono text-zinc-200">{status.invalidEvidenceCount}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Confidence</dt>
              <dd className="font-mono text-zinc-200">{status.evidenceConfidence}%</dd>
            </div>
          </dl>
          {status.missingFields.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-amber-200/90">
              {status.missingFields.map((m) => (
                <li key={m.field}>
                  • {m.field}: {m.count} trade(s)
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!status && !error && loading && (
        <p className="text-sm text-zinc-500">Evidence quality loading…</p>
      )}

      {!status && !error && !loading && (
        <section className="rounded-xl border border-zinc-800/80 p-5 text-sm text-zinc-400">
          <p className="font-medium text-zinc-200">Zero-state</p>
          <p className="mt-2">No completed trades yet — 0/12 evidence toward trust.</p>
        </section>
      )}
    </GoalShell>
  );
}
