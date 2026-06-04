"use client";

import type { CommitteeVerdict } from "@/lib/agents/types";
import { recBadgeClass } from "./agent-display";

interface CommitteeFinalVerdictProps {
  committee: CommitteeVerdict;
  marketRegime: string;
}

export default function CommitteeFinalVerdict({
  committee,
  marketRegime,
}: CommitteeFinalVerdictProps) {
  return (
    <section className="rounded-xl border-2 border-zinc-900 bg-zinc-900 p-5 text-zinc-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
      <p className="text-xs font-medium uppercase tracking-widest opacity-70">
        Committee Final Verdict
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h2 className="text-3xl font-bold">{committee.finalVerdict}</h2>
        <span className="rounded bg-white/10 px-2 py-1 text-xs dark:bg-zinc-900/10">
          Regime: {marketRegime}
        </span>
        {committee.riskVeto && (
          <span className="rounded bg-red-500/30 px-2 py-1 text-xs font-bold">
            RISK VETO
          </span>
        )}
      </div>

      <p className="mt-3 text-sm opacity-90">{committee.consensusSummary}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase opacity-70">Consensus</p>
          <ul className="mt-2 space-y-1 text-sm">
            {committee.agreementNotes.map((n) => (
              <li key={n}>✓ {n}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase opacity-70">
            Disagreement
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {committee.disagreementNotes.length > 0 ? (
              committee.disagreementNotes.map((n) => (
                <li key={n}>✗ {n}</li>
              ))
            ) : (
              <li className="opacity-60">None recorded</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase opacity-70">Top reasons</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {committee.topReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </div>

      <div
        className={`mt-4 rounded-lg p-3 text-sm ${recBadgeClass(committee.finalVerdict)}`}
      >
        <p className="text-xs font-semibold uppercase">Final action plan</p>
        <p className="mt-1 font-medium">{committee.finalActionPlan}</p>
      </div>
    </section>
  );
}
