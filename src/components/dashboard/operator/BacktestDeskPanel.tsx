"use client";

import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { replayRulesOnLogEntries } from "@/lib/backtest/replay-rules";
import { useMemo } from "react";

interface BacktestDeskPanelProps {
  entries: DecisionLogEntry[];
}

export default function BacktestDeskPanel({ entries }: BacktestDeskPanelProps) {
  const report = useMemo(
    () => replayRulesOnLogEntries(entries, 15),
    [entries],
  );

  if (report.sampled === 0) {
    return (
      <section className="desk-panel px-4 py-3">
        <p className="desk-section-title">Rule backtest · MVP 9</p>
        <p className="mt-1 text-xs text-zinc-600">
          Run more desk sessions to backtest current rules against stored replays.
        </p>
      </section>
    );
  }

  return (
    <section className="desk-panel px-4 py-3">
      <p className="desk-section-title">Rule backtest · MVP 9</p>
      <p className="mt-1 text-xs text-zinc-500">
        Replays {report.sampled} sessions with current no-trade / core checks (client-side).
      </p>
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <span className="text-zinc-400">
          Would SKIP now: <strong className="text-rose-400">{report.wouldSkipNow}</strong>
        </span>
        <span className="text-zinc-400">
          Stricter vs log: <strong className="text-amber-400">{report.stricterCount}</strong>
        </span>
      </div>
      <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-[10px] text-zinc-500">
        {report.rows.slice(0, 8).map((row) => (
          <li key={row.logId} className="rounded bg-zinc-950/60 px-2 py-1">
            {new Date(row.timestamp).toLocaleString("en-US", { timeZone: "Asia/Bangkok" })}{" "}
            · logged {row.loggedVerdict} · {row.delta}
            {row.reasons[0] ? ` · ${row.reasons[0]}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
