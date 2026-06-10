"use client";

import type { LearningProgressSnapshot } from "@/lib/learning-queue/types";

function fmtUsd(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function LearningQueuePanel({
  progress,
  showTable = false,
}: {
  progress: LearningProgressSnapshot | null | undefined;
  showTable?: boolean;
}) {
  if (!progress) {
    return (
      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <p className="text-sm text-zinc-500">Learning queue loading…</p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4"
      data-mvp="73C"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-indigo-400/80">
            MVP 73C · {progress.label}
          </p>
          <p className="mt-1 text-sm text-zinc-200">
            {progress.learnedCount} learned · {progress.pendingCount} pending ·{" "}
            {progress.closedJournalCount} closed
          </p>
        </div>
        <p className="text-xs text-zinc-400">
          Progress {progress.progressPct}%
        </p>
      </div>

      <p className="mt-2 text-xs text-zinc-500">{progress.nextExpectedAction}</p>

      <dl className="mt-4 grid gap-2 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-zinc-500">Pending review</dt>
          <dd className="font-mono text-amber-300">{progress.pendingCount}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Learned</dt>
          <dd className="font-mono text-emerald-300">{progress.learnedCount}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Excluded</dt>
          <dd className="font-mono text-zinc-400">{progress.excludedCount}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Records / closed</dt>
          <dd className="font-mono text-zinc-300">
            {progress.learningRecordCount}/{progress.closedJournalCount}
          </dd>
        </div>
      </dl>

      {progress.recurringMistakes.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wide text-rose-400/80">
            Recurring mistakes
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-rose-300/90">
            {progress.recurringMistakes.slice(0, 5).map((m) => (
              <li key={`${m.kind}-${m.message}`}>
                {m.severity === "CRITICAL" ? "⚠ " : "· "}
                {m.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showTable && progress.pendingRecords.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-zinc-500">
            Pending learning records
          </p>
          <table className="w-full min-w-[640px] text-left text-[11px]">
            <thead className="text-zinc-500">
              <tr>
                <th className="pb-2 pr-3">Symbol</th>
                <th className="pb-2 pr-3">Result</th>
                <th className="pb-2 pr-3">PnL</th>
                <th className="pb-2 pr-3">Close reason</th>
                <th className="pb-2 pr-3">Quality</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2">Closed</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {progress.pendingRecords.map((row) => (
                <tr key={row.learningRecordId} className="border-t border-zinc-800/80">
                  <td className="py-2 pr-3 font-mono">{row.symbol}</td>
                  <td className="py-2 pr-3">{row.result}</td>
                  <td className="py-2 pr-3 font-mono">{fmtUsd(row.netPnl)}</td>
                  <td className="py-2 pr-3 text-zinc-400">
                    {row.closeReason ?? row.entryReason ?? "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono">
                    {row.qualityGrade
                      ? `${row.qualityGrade} (${row.qualityScore ?? "—"})`
                      : "—"}
                  </td>
                  <td className="py-2 pr-3">{row.status}</td>
                  <td className="py-2">{fmtTime(row.closedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[10px] text-zinc-600">
        {progress.strategyAdjustmentPolicy}
      </p>
    </section>
  );
}
