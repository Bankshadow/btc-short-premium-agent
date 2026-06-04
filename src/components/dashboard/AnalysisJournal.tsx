"use client";

import type { AnalysisJournalEntry } from "@/lib/journal/analysis-journal";
import type { TradeRecommendation } from "@/lib/types/market";
import { formatTimestamp, formatUsd } from "./utils";

interface AnalysisJournalProps {
  entries: AnalysisJournalEntry[];
}

const verdictStyles: Record<TradeRecommendation, string> = {
  trade:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  wait: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  skip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function formatLiquidation(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return formatUsd(value);
}

function formatCandidate(
  candidate: AnalysisJournalEntry["callCandidate"],
): string {
  if (!candidate) return "—";
  return `${formatUsd(candidate.strike)} · Δ ${candidate.delta.toFixed(2)} · ${candidate.expiry}`;
}

export default function AnalysisJournal({ entries }: AnalysisJournalProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Local history
        </p>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Analysis Journal
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Last {entries.length} run{entries.length === 1 ? "" : "s"} saved in
          this browser (localStorage).
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No journal entries yet. Click Analyze Now to record your first
          analysis.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">BTC</th>
                <th className="px-3 py-2 font-medium">Playbook</th>
                <th className="px-3 py-2 font-medium">Committee</th>
                <th className="px-3 py-2 font-medium">Conf.</th>
                <th className="px-3 py-2 font-medium">Liq 24h</th>
                <th className="px-3 py-2 font-medium">IV/HV</th>
                <th className="px-3 py-2 font-medium">Δ / SD</th>
                <th className="px-3 py-2 font-medium">Call</th>
                <th className="px-3 py-2 font-medium">Put</th>
                <th className="px-3 py-2 font-medium">Top reasons</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="align-top text-zinc-700 dark:text-zinc-300"
                >
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    {formatTimestamp(entry.timestamp)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono">
                    {formatUsd(entry.btcPrice)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold uppercase ${verdictStyles[entry.verdict]}`}
                    >
                      {entry.verdict}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {entry.committeeVerdict ? (
                      <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold uppercase text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                        {entry.committeeVerdict}
                        {entry.riskVetoApplied ? " · veto" : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className="font-semibold">{entry.confidenceLevel}</span>
                    <span className="ml-1 text-xs text-zinc-500">
                      ({entry.confidence})
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">
                    {formatLiquidation(entry.liquidation24h)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono">
                    {entry.ivHvRatio.toFixed(2)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">
                    {entry.delta != null ? entry.delta.toFixed(2) : "—"}
                    {" / "}
                    {entry.sdDistance != null
                      ? entry.sdDistance.toFixed(2)
                      : "—"}
                  </td>
                  <td className="max-w-[140px] px-3 py-3 text-xs">
                    {formatCandidate(entry.callCandidate)}
                  </td>
                  <td className="max-w-[140px] px-3 py-3 text-xs">
                    {formatCandidate(entry.putCandidate)}
                  </td>
                  <td className="max-w-[200px] px-3 py-3">
                    <ul className="space-y-1 text-xs leading-relaxed">
                      {entry.topReasons.map((reason) => (
                        <li key={reason} className="line-clamp-2">
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="max-w-[180px] px-3 py-3 text-xs leading-relaxed">
                    {entry.actionSummary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
