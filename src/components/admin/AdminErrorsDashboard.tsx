"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "./AdminShell";
import { OpsKpi } from "@/components/ops/OpsShell";
import type { ObservabilityErrorRecord } from "@/lib/observability/types";

export default function AdminErrorsDashboard() {
  const [errors, setErrors] = useState<ObservabilityErrorRecord[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/errors");
    const data = (await res.json()) as { ok: boolean; errors?: ObservabilityErrorRecord[] };
    if (data.ok) setErrors(data.errors ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const critical = errors.filter((e) => e.severity === "critical").length;

  return (
    <AdminShell
      title="Errors"
      subtitle="Platform errors from automation, API, and integrations."
      activePath="/admin/errors"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <OpsKpi label="Total logged" value={String(errors.length)} hint="Recent window" />
        <OpsKpi label="Critical" value={String(critical)} hint="Needs review" />
        <OpsKpi
          label="Sources"
          value={String(new Set(errors.map((e) => e.source)).size)}
          hint="Distinct"
        />
      </div>

      <section className="desk-panel max-h-[480px] overflow-y-auto px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Error log</h2>
        <ul className="mt-3 space-y-2">
          {errors.length === 0 && (
            <li className="text-xs text-zinc-500">No errors recorded.</li>
          )}
          {errors.map((e) => (
            <li key={e.errorId} className="rounded border border-zinc-800 px-3 py-2 text-xs">
              <p className="text-rose-300">
                {e.severity} · {e.source}
              </p>
              <p className="text-zinc-400">{e.message}</p>
              <p className="text-[10px] text-zinc-600">
                {new Date(e.occurredAt).toLocaleString()}
                {e.linkedJobId ? ` · job ${e.linkedJobId}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
