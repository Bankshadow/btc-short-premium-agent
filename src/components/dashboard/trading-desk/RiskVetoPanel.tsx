"use client";

import type { AgentOutput } from "@/lib/types/agent";
import { recBadgeClass } from "./agent-display";

interface RiskVetoPanelProps {
  riskManager: AgentOutput;
}

export default function RiskVetoPanel({ riskManager }: RiskVetoPanelProps) {
  const veto = Boolean(riskManager.veto);

  return (
    <section
      className={`rounded-xl border p-5 ${
        veto
          ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
          : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Risk Veto Panel
        </h2>
        <span
          className={`rounded px-2.5 py-1 text-xs font-bold uppercase ${recBadgeClass(riskManager.recommendation)}`}
        >
          {veto ? "VETO ACTIVE" : "NO VETO"}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Risk Manager can block any TRADE. Caps: 1–2% per trade, 3–5% daily. No auto
        execution.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
        {riskManager.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {veto && riskManager.vetoReasons && riskManager.vetoReasons.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-white/80 p-3 dark:border-red-800 dark:bg-zinc-950/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
            Veto reasons
          </p>
          <ul className="mt-2 space-y-1 text-sm text-red-800 dark:text-red-200">
            {riskManager.vetoReasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
