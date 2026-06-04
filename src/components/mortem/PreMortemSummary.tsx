"use client";

import type { PreMortemResult } from "@/lib/mortem/types";
import { preMortemBlocksTicket } from "@/lib/mortem/apply-mortem-layer";

function verdictClass(v: PreMortemResult["preMortemVerdict"]): string {
  if (v === "PASS") return "text-emerald-400";
  if (v === "CAUTION") return "text-amber-300";
  return "text-rose-400";
}

interface PreMortemSummaryProps {
  preMortem: PreMortemResult;
}

export default function PreMortemSummary({ preMortem }: PreMortemSummaryProps) {
  const blocked = preMortemBlocksTicket(preMortem);

  return (
    <section
      className={`desk-panel px-4 py-4 ${
        blocked ? "border-rose-800/50 bg-rose-950/20" : "border-zinc-800"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="desk-section-title text-violet-400/90">
          Pre-mortem · before trade ticket
        </p>
        <span className={`text-sm font-bold ${verdictClass(preMortem.preMortemVerdict)}`}>
          {preMortem.preMortemVerdict}
        </span>
      </div>

      {blocked && (
        <p className="mt-3 rounded border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-300">
          TRADE BLOCKED BY DATA TRUST / CONFLICT GATE — Pre-mortem BLOCK:{" "}
          {preMortem.topFailureReason}
        </p>
      )}

      <p className="mt-2 text-xs text-zinc-400">
        If this trade loses: <span className="text-zinc-200">{preMortem.topFailureReason}</span>
      </p>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase text-zinc-600">
            Failure scenarios
          </p>
          <ul className="mt-1 space-y-1 text-[11px] text-zinc-400">
            {preMortem.failureScenarios.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-zinc-600">
            Invalidation triggers
          </p>
          <ul className="mt-1 space-y-1 text-[11px] text-zinc-400">
            {preMortem.invalidationTriggers.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-zinc-600">
        Monitor after entry: {preMortem.mitigationPlan[0]}
      </p>
    </section>
  );
}
