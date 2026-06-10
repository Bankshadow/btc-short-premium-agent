"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/api/fetch-json";
import { Badge, LoadingOrError, StatCard, useApi } from "@/components/use-api";
import type { OperatorStatus } from "@/lib/operator/operator-types";

export default function OperatorPage() {
  const { data, error, loading, reload } = useApi<OperatorStatus>("/api/operator/status");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [killReason, setKillReason] = useState("Operator pause");
  const [doubleConfirm, setDoubleConfirm] = useState(false);

  async function runAction(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fetchJson(path, { method: "POST", body: JSON.stringify(body) });
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const pending = LoadingOrError({ loading, error, onRetry: reload });
  if (pending) return pending;
  if (!data) return <p className="empty-state">No operator data.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Operator Control Center</h2>
          <p className="text-sm text-[var(--muted)]">MVP 19 · Human governance · Live locked</p>
        </div>
        <button type="button" className="btn" onClick={reload}>
          Refresh
        </button>
      </div>

      {actionError ? <div className="error-box">{actionError}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Kill switch"
          value={data.killSwitchActive ? "ACTIVE" : "OFF"}
          sub={data.killSwitchReason ?? undefined}
        />
        <StatCard label="Risk mode" value={data.riskMode} />
        <StatCard label="Engine" value={data.engineState} />
        <StatCard label="Max notional" value={`$${data.maxNotionalUsd}`} />
      </div>

      <div className="panel space-y-3">
        <h3 className="font-semibold">Governance</h3>
        <div className="flex flex-wrap gap-2">
          <Badge tone="safe">Live locked</Badge>
          <Badge tone={data.killSwitchActive ? "blocked" : "safe"}>
            Kill {data.killSwitchActive ? "ON" : "OFF"}
          </Badge>
          <Badge tone={data.engineState === "PAUSED" ? "blocked" : "safe"}>{data.engineState}</Badge>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Allowed symbols: {data.allowedSymbols.join(", ")}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={doubleConfirm}
            onChange={(e) => setDoubleConfirm(e.target.checked)}
          />
          Double confirm critical actions
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-3">
          <h3 className="font-semibold">Kill switch</h3>
          <input
            className="w-full rounded border border-[var(--border)] bg-transparent p-2 text-sm"
            value={killReason}
            onChange={(e) => setKillReason(e.target.value)}
            placeholder="Reason"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy || data.killSwitchActive}
              onClick={() =>
                runAction("/api/operator/kill-switch/enable", {
                  reason: killReason,
                  doubleConfirm,
                })
              }
            >
              Enable kill switch
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !data.killSwitchActive}
              onClick={() =>
                runAction("/api/operator/kill-switch/disable", { doubleConfirm })
              }
            >
              Disable kill switch
            </button>
          </div>
        </div>

        <div className="panel space-y-3">
          <h3 className="font-semibold">Engine &amp; risk mode</h3>
          <div className="flex flex-wrap gap-2">
            {(["CONSERVATIVE", "NORMAL", "AGGRESSIVE"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className="btn"
                disabled={busy}
                onClick={() =>
                  runAction("/api/operator/risk-mode", { mode, doubleConfirm })
                }
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy || data.engineState === "PAUSED"}
              onClick={() =>
                runAction("/api/operator/engine/pause", { reason: "Operator pause", doubleConfirm })
              }
            >
              Pause engine
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || data.engineState === "RUNNING"}
              onClick={() => runAction("/api/operator/engine/resume", { doubleConfirm })}
            >
              Resume engine
            </button>
          </div>
        </div>
      </div>

      <div className="panel space-y-3">
        <h3 className="font-semibold">Manual note</h3>
        <textarea
          className="w-full rounded border border-[var(--border)] bg-transparent p-2 text-sm"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Advisory note for next analysis cycle…"
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !note.trim()}
          onClick={() => {
            void runAction("/api/operator/manual-note", { text: note }).then(() => setNote(""));
          }}
        >
          Save note
        </button>
        {data.latestManualNotes.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {data.latestManualNotes.map((n) => (
              <li key={n.noteId} className="rounded border border-[var(--border)] p-2">
                {n.text}
                <span className="ml-2 text-xs text-[var(--muted)]">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="panel space-y-3">
        <h3 className="font-semibold">Pending approvals</h3>
        {data.pendingApprovals.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No pending improvement proposals.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.pendingApprovals.map((p) => (
              <li key={p.improvementId} className="rounded border border-[var(--border)] p-2">
                <Badge tone="wait">{p.type}</Badge> {p.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
