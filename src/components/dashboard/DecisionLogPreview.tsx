"use client";

import type { DecisionLogEntry } from "@/lib/journal/decision-log";
import { recBadgeClass } from "./trading-desk/agent-display";
import { formatTimestamp, formatUsd } from "./utils";

interface DecisionLogPreviewProps {
  entries: DecisionLogEntry[];
}

/** Compact preview of latest resolved / pending entries. */
export default function DecisionLogPreview({
  entries,
}: DecisionLogPreviewProps) {
  const latest = entries.slice(0, 3);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        Decision Log Preview
      </h3>
      {latest.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">No runs logged yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {latest.map((e) => (
            <li key={e.id} className="text-xs text-zinc-600 dark:text-zinc-400">
              {formatTimestamp(e.timestamp)} · {formatUsd(e.btcPrice)} ·{" "}
              <span className={recBadgeClass(e.finalVerdict)}>
                {e.finalVerdict}
              </span>{" "}
              · {e.outcomeStatus}
              {e.paperPnl != null && ` · ${e.paperPnl}% paper`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
