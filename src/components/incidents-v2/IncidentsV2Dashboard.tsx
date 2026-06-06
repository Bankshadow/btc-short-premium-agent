"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import type {
  AnomalyDetectionSummary,
  AnomalyIncident,
  AnomalyIncidentStatus,
} from "@/lib/anomaly-detection";

type ApiResponse = {
  ok: boolean;
  summary?: AnomalyDetectionSummary;
  incidents?: AnomalyIncident[];
  blocksRiskyActions?: boolean;
  error?: string;
};

const STATUS_OPTIONS: AnomalyIncidentStatus[] = [
  "OPEN",
  "INVESTIGATING",
  "RESOLVED",
  "SUPPRESSED",
];

function severityTone(severity: AnomalyIncident["severity"]): string {
  if (severity === "CRITICAL") return "text-rose-300 border-rose-900/40";
  if (severity === "WARNING") return "text-amber-300 border-amber-900/40";
  return "text-cyan-300 border-cyan-900/40";
}

export default function IncidentsV2Dashboard() {
  const [summary, setSummary] = useState<AnomalyDetectionSummary | null>(null);
  const [incidents, setIncidents] = useState<AnomalyIncident[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/incidents-v2", { cache: "no-store" });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.ok || !data.summary) {
        throw new Error(data.error ?? "Failed to load incidents");
      }
      setSummary(data.summary);
      setIncidents(data.summary.incidents);
      if (!selectedId && data.summary.incidents[0]) {
        setSelectedId(data.summary.incidents[0].incidentId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load incidents");
    } finally {
      setBusy(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const selected = useMemo(
    () => incidents.find((item) => item.incidentId === selectedId) ?? incidents[0] ?? null,
    [incidents, selectedId],
  );

  const patchStatus = async (
    incidentId: string,
    status: AnomalyIncidentStatus,
    resolutionNote: string | null = null,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/incidents-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          incidentId,
          status,
          resolutionNote,
          actor: "USER",
        }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.ok || !data.incidents) {
        throw new Error(data.error ?? "Incident update failed");
      }
      setIncidents(data.incidents);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Incident update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OpsShell
      badge="MVP 51 · Auto Incident"
      title="Auto Incident & Anomaly Detection"
      subtitle="Automatically detect broken operating loops and enforce CRITICAL safety blocks for risky actions."
      accent="rose"
      iconLetters="IV2"
      activePath="/incidents-v2"
      nav={[
        { href: "/", label: "← Cockpit" },
        { href: "/command-center", label: "Command Center" },
        { href: "/incidents", label: "Legacy incidents" },
      ]}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded border border-rose-800/50 bg-rose-950/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/30 disabled:opacity-50"
        >
          {busy ? "Scanning…" : "Run Detection"}
        </button>
      }
    >
      <p className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-2 text-xs text-rose-200/90">
        CRITICAL incidents block new testnet/live actions. AI cannot auto-resolve CRITICAL incidents.
      </p>

      {error && (
        <p className="rounded border border-rose-900/50 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi label="Open incidents" value={String(summary?.openCount ?? 0)} />
        <OpsKpi label="Warning open" value={String(summary?.warningOpenCount ?? 0)} />
        <OpsKpi label="Critical open" value={String(summary?.criticalOpenCount ?? 0)} />
        <OpsKpi
          label="Risky actions"
          value={summary?.blocksRiskyActions ? "BLOCKED" : "ALLOWED"}
          hint={summary?.generatedAt ? new Date(summary.generatedAt).toLocaleTimeString() : "—"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
          <h2 className="mb-2 text-sm font-semibold text-zinc-100">Incident feed</h2>
          {incidents.length === 0 ? (
            <p className="text-xs text-zinc-500">No incidents detected.</p>
          ) : (
            <ul className="max-h-[62vh] space-y-2 overflow-y-auto">
              {incidents.map((incident) => (
                <li key={incident.incidentId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(incident.incidentId)}
                    className={`w-full rounded border px-2 py-2 text-left text-xs ${
                      selected?.incidentId === incident.incidentId
                        ? "border-rose-700/60 bg-rose-950/30"
                        : "border-zinc-800 hover:bg-zinc-900/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 ${severityTone(incident.severity)}`}>
                        {incident.severity}
                      </span>
                      <span className="text-zinc-300">{incident.status}</span>
                    </div>
                    <p className="mt-1 truncate text-zinc-200">{incident.title}</p>
                    <p className="mt-1 font-mono text-[10px] text-zinc-600">
                      {incident.incidentId}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          {!selected ? (
            <p className="text-xs text-zinc-500">Select an incident from the feed.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-100">{selected.title}</h2>
                <select
                  value={selected.status}
                  onChange={(e) =>
                    void patchStatus(
                      selected.incidentId,
                      e.target.value as AnomalyIncidentStatus,
                    )
                  }
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-zinc-500">
                {new Date(selected.createdAt).toLocaleString()} · {selected.anomalyType} ·{" "}
                {selected.severity}
              </p>

              <div className="rounded border border-zinc-800 p-3 text-xs text-zinc-300">
                <p className="text-zinc-500">Impacted modules</p>
                <p>{selected.impactedModules.join(", ")}</p>
              </div>

              <div className="rounded border border-zinc-800 p-3 text-xs text-zinc-300">
                <p className="text-zinc-500">Recommended action</p>
                <p>{selected.recommendedAction}</p>
              </div>

              <div className="rounded border border-zinc-800 p-3 text-xs text-zinc-300">
                <p className="mb-1 text-zinc-500">Evidence</p>
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-[11px] text-zinc-400">
                  {JSON.stringify(selected.evidence, null, 2)}
                </pre>
              </div>

              {selected.status !== "RESOLVED" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void patchStatus(
                      selected.incidentId,
                      "RESOLVED",
                      "Resolved by operator via incidents-v2 dashboard.",
                    )
                  }
                  className="rounded border border-emerald-800/50 bg-emerald-950/20 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-50"
                >
                  Resolve incident
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <Link href="/command-center" className="text-rose-400 hover:underline">
          Command Center →
        </Link>
        <Link href="/testnet-monitor" className="text-cyan-400 hover:underline">
          Testnet Monitor →
        </Link>
        <Link href="/worker" className="text-cyan-400 hover:underline">
          Worker →
        </Link>
        <Link href="/ledger" className="text-indigo-400 hover:underline">
          Ledger →
        </Link>
        <Link href="/notifications" className="text-amber-400 hover:underline">
          Notifications →
        </Link>
      </div>
    </OpsShell>
  );
}
