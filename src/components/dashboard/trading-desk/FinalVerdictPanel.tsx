"use client";

import type { CommitteeVerdict } from "@/lib/agents/types";
import { recBadgeClass } from "./agent-display";

interface FinalVerdictPanelProps {
  verdict: CommitteeVerdict;
}

export default function FinalVerdictPanel({ verdict }: FinalVerdictPanelProps) {
  return (
    <section className="rounded-xl border-2 border-zinc-900 bg-zinc-900 p-5 text-zinc-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest opacity-70">
            Final Verdict
          </p>
          <h2 className="mt-1 text-2xl font-bold">{verdict.recommendation}</h2>
          <p className="mt-2 text-sm opacity-80">{verdict.summary}</p>
        </div>
        <span
          className={`rounded px-3 py-1.5 text-sm font-bold ${recBadgeClass(verdict.recommendation)}`}
        >
          {verdict.confidence}% confidence
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase opacity-70">Agreement</p>
          <ul className="mt-2 space-y-1 text-sm">
            {verdict.agreementNotes.length > 0 ? (
              verdict.agreementNotes.map((n) => <li key={n}>✓ {n}</li>)
            ) : (
              <li className="opacity-60">No full agreement</li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase opacity-70">
            Disagreement
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {verdict.disagreementNotes.length > 0 ? (
              verdict.disagreementNotes.map((n) => <li key={n}>✗ {n}</li>)
            ) : (
              <li className="opacity-60">None</li>
            )}
          </ul>
        </div>
      </div>

      {verdict.riskVetoApplied && (
        <p className="mt-3 rounded bg-red-500/20 px-3 py-2 text-sm text-red-100 dark:text-red-900">
          Risk Manager veto applied — TRADE blocked until cleared.
        </p>
      )}

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase opacity-70">
          Top 3 reasons
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {verdict.topReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </div>

      <div className="mt-4 rounded-lg bg-white/10 p-3 text-sm dark:bg-zinc-900/10">
        <p className="text-xs font-semibold uppercase opacity-70">
          Action summary (hypothetical)
        </p>
        <p className="mt-1">{verdict.actionSummary}</p>
      </div>
    </section>
  );
}
