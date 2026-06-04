"use client";

import type { CommitteeVerdict } from "@/lib/agents/types";
import type { ConflictGateResult } from "@/lib/data-trust/types";

interface CommitteeFinalVerdictProps {
  committee: CommitteeVerdict;
  marketRegime: string;
  conflictGate?: ConflictGateResult;
}

export default function CommitteeFinalVerdict({
  committee,
  marketRegime,
  conflictGate,
}: CommitteeFinalVerdictProps) {
  return (
    <section className="desk-panel relative overflow-hidden border-amber-900/40 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-5 desk-scan-line">
      <div className="relative">
        <p className="desk-section-title text-amber-500/80">
          Investment committee · final call
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2
            className={`text-4xl font-black tracking-tight ${
              committee.finalVerdict === "TRADE"
                ? "text-emerald-400"
                : committee.finalVerdict === "SKIP"
                  ? "text-rose-400"
                  : "text-amber-300"
            }`}
          >
            {committee.finalVerdict}
          </h2>
          <span className="rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 font-mono text-xs text-zinc-300">
            {marketRegime}
          </span>
          {committee.riskVeto && (
            <span className="rounded-md bg-red-950 px-2.5 py-1 text-xs font-bold text-red-300 ring-1 ring-red-800">
              RISK VETO ACTIVE
            </span>
          )}
          {conflictGate?.tradeBlocked && (
            <span className="rounded-md bg-rose-950 px-2.5 py-1 text-xs font-bold text-rose-300 ring-1 ring-rose-800">
              GATE BLOCK
            </span>
          )}
        </div>

        {conflictGate?.tradeBlocked && (
          <p className="mt-3 rounded border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-300">
            TRADE BLOCKED BY DATA TRUST / CONFLICT GATE
          </p>
        )}

        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">
          {committee.consensusSummary}
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="desk-section-title">Aligned</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              {committee.agreementNotes.slice(0, 4).map((n) => (
                <li key={n} className="text-emerald-400/90">
                  + {n}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="desk-section-title">Dissent</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              {committee.disagreementNotes.length > 0 ? (
                committee.disagreementNotes.slice(0, 4).map((n) => (
                  <li key={n} className="text-amber-400/90">
                    − {n}
                  </li>
                ))
              ) : (
                <li className="text-zinc-600">No dissent logged</li>
              )}
            </ul>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="desk-section-title">Top reasons</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-zinc-300">
              {committee.topReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-amber-900/30 bg-amber-950/20 px-4 py-3">
          <p className="desk-section-title text-amber-600/70">Desk action plan</p>
          <p className="mt-1 text-sm font-medium text-amber-100">
            {committee.finalActionPlan}
          </p>
        </div>
      </div>
    </section>
  );
}
