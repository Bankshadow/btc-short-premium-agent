"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "./AdminShell";
import { OpsKpi } from "@/components/ops/OpsShell";
import type { PlatformHealthReport } from "@/lib/observability/types";
import type { ObservabilityIncident } from "@/lib/observability/types";

function levelTone(level: string): string {
  if (level === "HEALTHY") return "text-emerald-300";
  if (level === "DEGRADED") return "text-amber-300";
  return "text-rose-300";
}

export default function AdminHealthDashboard() {
  const [report, setReport] = useState<PlatformHealthReport | null>(null);
  const [incidents, setIncidents] = useState<ObservabilityIncident[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/health");
      const data = (await res.json()) as {
        ok: boolean;
        report?: PlatformHealthReport;
        incidents?: ObservabilityIncident[];
      };
      if (data.ok) {
        setReport(data.report ?? null);
        setIncidents(data.incidents ?? []);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AdminShell
      title="Platform health"
      subtitle="System health score across platform, trading, data, automation, risk, and integrations."
      activePath="/admin/health"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-lg bg-rose-800/70 px-3 py-1.5 text-xs text-zinc-100 disabled:opacity-50"
        >
          Refresh health
        </button>
        <Link href="/command-center" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300">
          Command center
        </Link>
      </div>

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OpsKpi
              label="Overall score"
              value={`${report.overallScore}/100`}
              hint={report.overallLevel}
            />
            <OpsKpi
              label="Live posture"
              value={report.liveTradingPosture}
              hint={report.commandCenterShouldBlock ? "Command center blocked" : "Monitoring"}
            />
            <OpsKpi
              label="Failed jobs"
              value={String(report.signals.automation.failedJobCount)}
              hint="Pending retry"
            />
            <OpsKpi
              label="Policy blocks (1h)"
              value={String(report.signals.policyBlocks1h)}
              hint="Recent blocks"
            />
          </div>

          <section className="desk-panel px-4 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Health dimensions</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {report.dimensions.map((d) => (
                <li
                  key={d.dimension}
                  className="rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs"
                >
                  <p className="font-medium capitalize text-zinc-200">{d.dimension}</p>
                  <p className={levelTone(d.level)}>
                    {d.level} · {d.score}/100
                  </p>
                  <p className="mt-1 text-zinc-500">{d.summary}</p>
                </li>
              ))}
            </ul>
          </section>

          {report.safetyNotices.length > 0 && (
            <section className="rounded-lg border border-rose-900/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-200">
              {report.safetyNotices.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </section>
          )}
        </>
      )}

      <section className="desk-panel px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Auto-created incidents</h2>
        <ul className="mt-3 space-y-2">
          {incidents.length === 0 && (
            <li className="text-xs text-zinc-500">No observability incidents logged.</li>
          )}
          {incidents.slice(0, 10).map((i) => (
            <li key={i.id} className="rounded border border-zinc-800 px-3 py-2 text-xs">
              <p className="text-zinc-200">
                {i.severity} · {i.type} ·{" "}
                <span className={i.status === "resolved" ? "text-emerald-400" : "text-amber-400"}>
                  {i.status}
                </span>
              </p>
              <p className="text-zinc-500">{i.description}</p>
              {i.links.failedJobId && (
                <p className="text-[10px] text-zinc-600">Job: {i.links.failedJobId}</p>
              )}
            </li>
          ))}
        </ul>
        <Link href="/incidents" className="mt-2 inline-block text-[11px] text-rose-400 hover:underline">
          Client incidents →
        </Link>
      </section>
    </AdminShell>
  );
}
