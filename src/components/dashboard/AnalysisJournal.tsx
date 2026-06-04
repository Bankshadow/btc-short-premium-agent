"use client";

import type { AnalysisJournalEntry } from "@/lib/journal/analysis-journal";
import { recBadgeClass } from "./trading-desk/agent-display";
import { formatTimestamp, formatUsd } from "./utils";

interface AnalysisJournalProps {
  entries: AnalysisJournalEntry[];
}

export default function AnalysisJournal({ entries }: AnalysisJournalProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Local history (localStorage)
        </p>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Journal
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Saves regime, agent outputs, committee verdict, risk veto, and paper
          outcome placeholder per run.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No journal entries yet. Click Analyze Now to record a run.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-zinc-500">
                    {formatTimestamp(entry.timestamp)}
                  </p>
                  <p className="font-mono text-sm font-semibold">
                    BTC {formatUsd(entry.btcPrice)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                    {entry.regime}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold ${recBadgeClass(entry.committeeVerdict)}`}
                  >
                    {entry.committeeVerdict}
                  </span>
                  {entry.riskVeto && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800 dark:bg-red-950 dark:text-red-300">
                      VETO
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs font-medium text-zinc-500">Top reasons</p>
                <ul className="mt-1 list-disc pl-4 text-xs text-zinc-600 dark:text-zinc-400">
                  {entry.topReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>

              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-medium">Action:</span> {entry.actionSummary}
              </p>

              <p className="mt-1 text-xs text-zinc-400">
                Paper outcome: {entry.paperOutcome ?? "— (record manually later)"}
              </p>

              {entry.agentOutputs.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-zinc-500">
                    Agent outputs ({entry.agentOutputs.length})
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {entry.agentOutputs.map((a) => (
                      <li key={a.agentName}>
                        {a.agentName}: {a.recommendation} ({a.strategyType})
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
