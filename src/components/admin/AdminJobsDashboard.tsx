"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "./AdminShell";
import { OpsKpi } from "@/components/ops/OpsShell";
import type { AdminJobsSnapshot } from "@/lib/observability/types";

export default function AdminJobsDashboard() {
  const [snapshot, setSnapshot] = useState<AdminJobsSnapshot | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/jobs");
    const data = (await res.json()) as { ok: boolean; snapshot?: AdminJobsSnapshot };
    if (data.ok) setSnapshot(data.snapshot ?? null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AdminShell
      title="Automation jobs"
      subtitle="Failed jobs, recent runs, and retry status from the control plane."
      activePath="/admin/jobs"
    >
      {snapshot && (
        <div className="grid gap-3 sm:grid-cols-3">
          <OpsKpi label="Failed" value={String(snapshot.failedJobs.length)} hint="Pending" />
          <OpsKpi label="Recent runs" value={String(snapshot.recentRuns.length)} hint="History" />
          <OpsKpi label="Active" value={String(snapshot.activeJobs.length)} hint="Running now" />
        </div>
      )}

      <section className="desk-panel px-4 py-4">
        <h2 className="text-sm font-semibold text-rose-300">Failed jobs</h2>
        <ul className="mt-3 space-y-2">
          {(snapshot?.failedJobs ?? []).length === 0 && (
            <li className="text-xs text-zinc-500">No failed jobs.</li>
          )}
          {(snapshot?.failedJobs ?? []).map((j) => (
            <li key={j.failedJobId} className="rounded border border-rose-900/30 px-3 py-2 text-xs">
              <p className="font-medium text-rose-200">{j.jobType}</p>
              <p className="text-zinc-500">{j.error}</p>
              <p className="text-[10px] text-zinc-600">
                Retries {j.retryCount} · backoff until {j.backoffUntil ?? "—"}
              </p>
            </li>
          ))}
        </ul>
        <Link href="/automation-control" className="mt-2 inline-block text-[11px] text-cyan-400 hover:underline">
          Automation control →
        </Link>
      </section>

      <section className="desk-panel px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Recent runs</h2>
        <ul className="mt-3 space-y-1 text-[11px] text-zinc-400">
          {(snapshot?.recentRuns ?? []).slice(0, 8).map((r) => (
            <li key={r.runId}>
              {r.status} · {r.jobs.length} jobs · {new Date(r.startedAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
