"use client";

import type { DecisionLogEntry } from "@/lib/journal/decision-log";
import { replaySnapshotFromLog } from "@/lib/replay/build-replay-snapshot";
import { recBadgeClass } from "../trading-desk/agent-display";
import { formatTimestamp, formatUsd } from "../utils";
import { useMemo, useState } from "react";

interface ReplayDeskPanelProps {
  entries: DecisionLogEntry[];
}

export default function ReplayDeskPanel({ entries }: ReplayDeskPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    entries[0]?.id ?? null,
  );

  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? entries[0],
    [entries, selectedId],
  );

  const snapshot = useMemo(
    () => (selected ? replaySnapshotFromLog(selected) : null),
    [selected],
  );

  if (entries.length === 0) {
    return (
      <section className="desk-panel p-4 text-xs text-zinc-500">
        No sessions to replay — run the desk first.
      </section>
    );
  }

  if (!snapshot || !selected) return null;

  return (
    <section className="desk-panel border-blue-900/40">
      <div className="border-b border-zinc-800 px-4 py-3">
        <p className="desk-section-title text-blue-400/90">Simulation · MVP 6</p>
        <h2 className="text-sm font-semibold text-zinc-100">Session replay</h2>
        <p className="mt-0.5 text-[10px] text-zinc-500">
          Read-only playback of a past committee run (no re-execution).
        </p>
      </div>

      <div className="flex flex-col gap-3 p-4 lg:flex-row">
        <div className="max-h-48 shrink-0 overflow-y-auto lg:w-48">
          {entries.slice(0, 20).map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setSelectedId(e.id)}
              className={`mb-1 w-full rounded-lg border px-2 py-1.5 text-left text-[10px] ${
                e.id === selectedId
                  ? "border-blue-700 bg-blue-950/40 text-blue-100"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
              }`}
            >
              {formatTimestamp(e.timestamp)}
              <br />
              {e.finalVerdict} · {e.outcomeStatus}
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-xs text-zinc-400">
              {formatTimestamp(snapshot.analyzedAt)} · BTC{" "}
              {formatUsd(snapshot.btcPrice)} · {snapshot.marketRegime}
            </p>
            <p className="mt-2 text-lg font-bold text-zinc-100">
              Committee: {snapshot.committeeVerdict}
              {snapshot.riskVeto && (
                <span className="ml-2 text-xs text-red-400">RISK VETO</span>
              )}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              {snapshot.topReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-zinc-500">{snapshot.actionPlan}</p>
          </div>

          {snapshot.researchBullets.length > 0 && (
            <div className="rounded-lg border border-indigo-900/40 p-2">
              <p className="desk-section-title">Research at session</p>
              <ul className="mt-1 text-[10px] text-zinc-400">
                {snapshot.researchBullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {snapshot.agentOutputs.map((agent) => (
              <div
                key={agent.agentName}
                className="rounded border border-zinc-800 px-2 py-1.5"
              >
                <div className="flex justify-between gap-1">
                  <span className="text-[10px] font-medium text-zinc-300">
                    {agent.agentName.replace(/ Agent$/, "")}
                  </span>
                  <span
                    className={`rounded px-1 text-[9px] font-bold ${recBadgeClass(agent.recommendation)}`}
                  >
                    {agent.recommendation}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[9px] text-zinc-500">
                  {agent.reasons[0]}
                </p>
              </div>
            ))}
          </div>

          {selected.outcomeStatus === "RESOLVED" && (
            <p className="text-[10px] text-emerald-400/90">
              Outcome resolved · paper {selected.paperPnl ?? 0}%
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
