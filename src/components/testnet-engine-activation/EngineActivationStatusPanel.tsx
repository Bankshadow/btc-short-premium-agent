"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  EngineActivationHealthResponse,
  EvidenceQualityStatusResponse,
  ReconciliationStatusResponse,
} from "@/lib/testnet-engine-activation/types";

const STATUS_CLASS: Record<string, string> = {
  OK: "text-emerald-300",
  WARNING: "text-amber-300",
  BLOCKED: "text-rose-300",
  INSUFFICIENT: "text-zinc-400",
};

function Row({
  label,
  status,
  detail,
  href,
}: {
  label: string;
  status: string;
  detail: string;
  href: string;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-zinc-800/80 px-3 py-2 text-xs">
      <div>
        <p className="font-medium text-zinc-200">{label}</p>
        <p className="mt-0.5 text-zinc-500">{detail}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-mono font-semibold ${STATUS_CLASS[status] ?? "text-zinc-300"}`}>
          {status}
        </span>
        <Link href={href} className="text-emerald-400 hover:underline">
          →
        </Link>
      </div>
    </li>
  );
}

/** MVP 95 — shared health / reconciliation / evidence activation status for Reports. */
export default function EngineActivationStatusPanel() {
  const [health, setHealth] = useState<EngineActivationHealthResponse | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationStatusResponse | null>(null);
  const [evidence, setEvidence] = useState<EvidenceQualityStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, reconRes, evidenceRes] = await Promise.all([
        fetch("/api/analysis/health", { cache: "no-store" }),
        fetch("/api/reconciliation/status", { cache: "no-store" }),
        fetch("/api/evidence-quality/status", { cache: "no-store" }),
      ]);
      const [healthData, reconData, evidenceData] = await Promise.all([
        healthRes.json(),
        reconRes.json(),
        evidenceRes.json(),
      ]);
      if (!healthRes.ok || healthData.ok === false) {
        throw new Error(healthData.error ?? "Engine health unavailable");
      }
      if (!reconRes.ok || reconData.ok === false) {
        throw new Error(reconData.error ?? "Reconciliation unavailable");
      }
      if (!evidenceRes.ok || evidenceData.ok === false) {
        throw new Error(evidenceData.error ?? "Evidence quality unavailable");
      }
      setHealth(healthData as EngineActivationHealthResponse);
      setReconciliation(reconData as ReconciliationStatusResponse);
      setEvidence(evidenceData as EvidenceQualityStatusResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation status failed");
      setHealth(null);
      setReconciliation(null);
      setEvidence(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading && !health) {
    return <p className="text-sm text-zinc-500">Loading activation status…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">
        {error}
        <button
          type="button"
          onClick={() => void refresh()}
          className="ml-2 text-emerald-300 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-mvp="95">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Engine activation (MVP 95)
        </h3>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      <ul className="space-y-2">
        {health && (
          <Row
            label="Engine health"
            status={health.status}
            detail={
              health.blockers[0] ??
              health.warnings[0] ??
              `${health.checks.length} checks passed`
            }
            href="/advanced/engine-health"
          />
        )}
        {reconciliation && (
          <Row
            label="Reconciliation"
            status={reconciliation.status}
            detail={reconciliation.message}
            href="/advanced/reconciliation"
          />
        )}
        {evidence && (
          <Row
            label="Evidence quality"
            status={evidence.status}
            detail={evidence.message}
            href="/advanced/evidence-quality"
          />
        )}
      </ul>
    </div>
  );
}
