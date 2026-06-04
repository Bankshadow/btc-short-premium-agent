"use client";

import type { CommitteeVerdict } from "@/lib/types/agent";
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
            Final Verdict — Committee
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

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-white/10 px-2 py-1 dark:bg-zinc-900/10">
          Agreement: {verdict.agreement}
        </span>
        {verdict.riskVetoApplied && (
          <span className="rounded bg-red-500/20 px-2 py-1 text-red-200 dark:text-red-800">
            Risk veto applied
          </span>
        )}
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
          Top 3 reasons
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {verdict.topReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </div>

      <div className="mt-4 rounded-lg bg-white/10 p-3 text-sm dark:bg-zinc-900/10">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
          Action plan (hypothetical)
        </p>
        <p className="mt-1">{verdict.actionPlan}</p>
      </div>

      {verdict.dissent.length > 0 && (
        <div className="mt-4 text-xs opacity-75">
          <p className="font-semibold uppercase tracking-wide">Dissent</p>
          <ul className="mt-1 space-y-0.5">
            {verdict.dissent.map((d) => (
              <li key={d}>• {d}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
