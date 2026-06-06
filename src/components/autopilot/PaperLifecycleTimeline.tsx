"use client";

import {
  PAPER_LIFECYCLE_STATUS_LABELS,
} from "@/lib/paper-autopilot/config";
import type { PaperLifecycleRecord } from "@/lib/paper-autopilot/types";

const STATUS_COLOR: Record<string, string> = {
  CREATED: "text-zinc-400",
  OPEN: "text-cyan-300",
  MONITORING: "text-sky-300",
  CLOSE_RECOMMENDED: "text-amber-300",
  CLOSED: "text-violet-300",
  RESOLVED: "text-emerald-300",
};

const BOOK_BADGE: Record<string, string> = {
  PAPER_STRICT: "Paper",
  PAPER_SHADOW: "Shadow",
  DEMO: "Demo",
};

interface PaperLifecycleTimelineProps {
  records: PaperLifecycleRecord[];
  limit?: number;
}

export default function PaperLifecycleTimeline({
  records,
  limit = 8,
}: PaperLifecycleTimelineProps) {
  const sorted = [...records]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);

  if (sorted.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        No paper lifecycle records yet. Run analysis with paper autopilot enabled.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {sorted.map((record) => (
        <li
          key={record.lifecycleId}
          className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-zinc-500">{record.tradeId}</span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
              {BOOK_BADGE[record.book] ?? record.book}
            </span>
            <span className={STATUS_COLOR[record.status] ?? "text-zinc-300"}>
              {PAPER_LIFECYCLE_STATUS_LABELS[record.status]}
            </span>
            {record.unrealizedPnlPct != null && record.status !== "CLOSED" && (
              <span
                className={
                  record.unrealizedPnlPct >= 0 ? "text-emerald-400" : "text-rose-400"
                }
              >
                uPnL {record.unrealizedPnlPct >= 0 ? "+" : ""}
                {record.unrealizedPnlPct}%
              </span>
            )}
            {record.realizedPnlPct != null && (
              <span
                className={
                  record.realizedPnlPct >= 0 ? "text-emerald-400" : "text-rose-400"
                }
              >
                PnL {record.realizedPnlPct >= 0 ? "+" : ""}
                {record.realizedPnlPct}%
              </span>
            )}
          </div>
          <ol className="mt-2 space-y-1 border-l border-zinc-700 pl-3">
            {record.events.slice(-5).map((ev, i) => (
              <li key={`${ev.at}-${i}`} className="text-[11px] text-zinc-500">
                <span className="text-zinc-600">{ev.at.slice(11, 19)}</span>{" "}
                <span className="text-zinc-400">{ev.status}</span> — {ev.note}
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ul>
  );
}
