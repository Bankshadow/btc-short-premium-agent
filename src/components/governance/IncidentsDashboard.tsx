"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  createIncident,
  deleteIncident,
  loadIncidents,
  updateIncident,
} from "@/lib/governance/incidents-store";
import type {
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
} from "@/lib/governance/governance-types";

const TYPES: IncidentType[] = [
  "data_failure",
  "risk_breach",
  "operator_override",
  "kill_switch",
  "paper_sync",
  "alert_failure",
  "other",
];

const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];
const STATUSES: IncidentStatus[] = ["open", "investigating", "resolved", "closed"];

export default function IncidentsDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "other" as IncidentType,
    severity: "medium" as IncidentSeverity,
    description: "",
    affectedDecisionId: "",
    rootCause: "",
    correctiveAction: "",
  });

  const incidents = useMemo(() => {
    void refreshKey;
    return loadIncidents();
  }, [refreshKey]);

  const selected = incidents.find((i) => i.id === selectedId) ?? incidents[0] ?? null;

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleCreate = () => {
    if (!form.description.trim()) return;
    createIncident({
      type: form.type,
      severity: form.severity,
      description: form.description,
      affectedDecisionId: form.affectedDecisionId || null,
      rootCause: form.rootCause,
      correctiveAction: form.correctiveAction,
    });
    setForm({
      type: "other",
      severity: "medium",
      description: "",
      affectedDecisionId: "",
      rootCause: "",
      correctiveAction: "",
    });
    refresh();
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-3 py-4 sm:px-5">
      <header className="desk-panel flex flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div>
          <p className="desk-section-title text-rose-400/90">MVP 14</p>
          <h1 className="text-lg font-semibold text-zinc-50">Incident review</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Post-mortems for desk failures — planning only, no fund movement.
          </p>
        </div>
        <Link href="/governance" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
          ← Governance
        </Link>
      </header>

      <section className="desk-panel px-4 py-4">
        <h2 className="desk-section-title">New incident</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-500">
            Type
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as IncidentType })}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Severity
            <select
              value={form.severity}
              onChange={(e) =>
                setForm({ ...form, severity: e.target.value as IncidentSeverity })
              }
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block text-xs text-zinc-500">
          Description
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200"
          />
        </label>
        <label className="mt-2 block text-xs text-zinc-500">
          Affected decision ID (optional)
          <input
            value={form.affectedDecisionId}
            onChange={(e) => setForm({ ...form, affectedDecisionId: e.target.value })}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-200"
          />
        </label>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!form.description.trim()}
          className="mt-3 rounded bg-rose-900/70 px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          Create incident
        </button>
      </section>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ul className="desk-panel max-h-[60vh] space-y-1 overflow-y-auto p-2">
          {incidents.length === 0 ? (
            <li className="px-2 py-4 text-xs text-zinc-600">No incidents.</li>
          ) : (
            incidents.map((inc) => (
              <li key={inc.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(inc.id)}
                  className={`w-full rounded px-2 py-2 text-left text-xs ${
                    selected?.id === inc.id ? "bg-rose-950/50 ring-1 ring-rose-800/50" : "hover:bg-zinc-900"
                  }`}
                >
                  <span className="font-medium text-zinc-200">{inc.type}</span>
                  <span className="ml-2 text-rose-400/80">{inc.severity}</span>
                  <p className="mt-0.5 truncate text-zinc-600">{inc.description}</p>
                </button>
              </li>
            ))
          )}
        </ul>

        {selected && (
          <section className="desk-panel space-y-3 px-4 py-4">
            <div className="flex justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">{selected.id}</h2>
              <select
                value={selected.status}
                onChange={(e) => {
                  updateIncident(selected.id, {
                    status: e.target.value as IncidentStatus,
                  });
                  refresh();
                }}
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-zinc-500">
              {selected.createdAt.slice(0, 19)} · {selected.type} · {selected.severity}
            </p>
            <p className="text-sm text-zinc-300">{selected.description}</p>
            <label className="block text-xs text-zinc-500">
              Root cause
              <textarea
                defaultValue={selected.rootCause}
                onBlur={(e) => {
                  updateIncident(selected.id, { rootCause: e.target.value });
                  refresh();
                }}
                rows={2}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Corrective action
              <textarea
                defaultValue={selected.correctiveAction}
                onBlur={(e) => {
                  updateIncident(selected.id, { correctiveAction: e.target.value });
                  refresh();
                }}
                rows={2}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200"
              />
            </label>
            {selected.affectedDecisionId && (
              <p className="font-mono text-[10px] text-zinc-600">
                Decision: {selected.affectedDecisionId}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                deleteIncident(selected.id);
                setSelectedId(null);
                refresh();
              }}
              className="text-xs text-rose-500 hover:text-rose-400"
            >
              Delete incident
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
