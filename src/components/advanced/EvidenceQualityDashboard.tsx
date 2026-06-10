"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import GoalShell from "@/components/goal/GoalShell";
import EvidenceQualityPanel from "@/components/evidence-quality/EvidenceQualityPanel";
import type { EvidenceQualitySnapshot } from "@/lib/evidence-quality/types";

export default function EvidenceQualityDashboard() {
  const [snapshot, setSnapshot] = useState<EvidenceQualitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analysis/evidence-quality", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Failed to load evidence quality");
      }
      setSnapshot(json.snapshot as EvidenceQualitySnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
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

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Evidence quality status
        </h2>
        <div className="mt-3">
          <EvidenceQualityPanel quality={snapshot} />
        </div>
      </section>
    </GoalShell>
  );
}
