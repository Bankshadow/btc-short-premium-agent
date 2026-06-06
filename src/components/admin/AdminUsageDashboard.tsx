"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "./AdminShell";
import { OpsKpi } from "@/components/ops/OpsShell";
import type { ObservabilityUsageRecord } from "@/lib/observability/types";

export default function AdminUsageDashboard() {
  const [usage, setUsage] = useState<ObservabilityUsageRecord[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/health");
    const data = (await res.json()) as { ok: boolean; usage?: ObservabilityUsageRecord[] };
    if (data.ok) setUsage(data.usage ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byAction = usage.reduce<Record<string, number>>((acc, u) => {
    acc[u.action] = (acc[u.action] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AdminShell
      title="Usage"
      subtitle="Operator actions tracked for audit and capacity planning."
      activePath="/admin/usage"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <OpsKpi label="Events" value={String(usage.length)} hint="Logged actions" />
        <OpsKpi label="Action types" value={String(Object.keys(byAction).length)} hint="Distinct" />
        <OpsKpi
          label="Latest"
          value={usage[0] ? new Date(usage[0].occurredAt).toLocaleTimeString() : "—"}
          hint="Last event"
        />
      </div>

      <section className="desk-panel px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">By action</h2>
        <ul className="mt-3 space-y-1 text-xs text-zinc-400">
          {Object.entries(byAction).map(([action, count]) => (
            <li key={action}>
              {action}: {count}
            </li>
          ))}
          {Object.keys(byAction).length === 0 && (
            <li className="text-zinc-500">No usage events yet — actions log on admin API calls.</li>
          )}
        </ul>
      </section>

      <section className="desk-panel max-h-[360px] overflow-y-auto px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Recent events</h2>
        <ul className="mt-3 space-y-1 text-[11px] text-zinc-500">
          {usage.slice(0, 30).map((u) => (
            <li key={u.usageId}>
              {u.action} · {u.userRole} · {new Date(u.occurredAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
