"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CombinedEngineStatusSnapshot } from "@/lib/engine-consistency/types";

const CLASS: Record<CombinedEngineStatusSnapshot["summary"], string> = {
  OK: "border-emerald-900/50 bg-emerald-950/20 text-emerald-100",
  WARNING: "border-amber-900/50 bg-amber-950/20 text-amber-100",
  BLOCKED: "border-rose-900/50 bg-rose-950/20 text-rose-100",
};

export default function EngineStatusBanner() {
  const [combined, setCombined] = useState<CombinedEngineStatusSnapshot | null>(null);

  useEffect(() => {
    void fetch("/api/analysis/health", { cache: "no-store" })
      .then((r) => r.json())
      .then(
        (data: { ok: boolean; combined?: CombinedEngineStatusSnapshot }) => {
          if (data.ok && data.combined) setCombined(data.combined);
        },
      )
      .catch(() => setCombined(null));
  }, []);

  if (!combined) return null;

  return (
    <Link
      href="/advanced/reconciliation"
      className={`block rounded-xl border p-3 transition hover:opacity-90 ${CLASS[combined.summary]}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide opacity-80">Engine Health</p>
          <p className="text-sm font-semibold">{combined.summaryLabel}</p>
        </div>
        <span className="text-xs opacity-70">Reconciliation →</span>
      </div>
      {combined.blocksNewTrades && (
        <p className="mt-1 text-xs opacity-90">
          New trades blocked — position state uncertain until reconciliation.
        </p>
      )}
    </Link>
  );
}
