"use client";

import type { AgentOutput } from "@/lib/agents/types";
import { confidenceBadgeClass, recBadgeClass } from "./agent-display";

interface RiskVetoPanelProps {
  riskManager: AgentOutput;
}

export default function RiskVetoPanel({ riskManager }: RiskVetoPanelProps) {
  const veto = Boolean(riskManager.veto);

  return (
    <section
      className={`desk-panel p-4 ${
        veto ? "border-red-900/60" : "border-emerald-900/40"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">Risk desk</h2>
        <div className="flex gap-1.5">
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-bold ${veto ? recBadgeClass("SKIP") : recBadgeClass("WAIT")}`}
          >
            {veto ? "VETO" : "CLEAR"}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-[10px] ${confidenceBadgeClass(riskManager.confidence)}`}
          >
            {riskManager.confidence}
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Binding gate — challenges bull & bear before committee
      </p>
      <ul className="mt-3 space-y-1 text-xs text-zinc-400">
        {riskManager.reasons.slice(0, 5).map((r) => (
          <li key={r} className="border-l border-zinc-700 pl-2">
            {r}
          </li>
        ))}
      </ul>
      {veto && riskManager.vetoReasons && (
        <div className="mt-3 rounded-lg border border-red-900/50 bg-red-950/30 p-3">
          <p className="desk-section-title text-red-400">Veto reasons</p>
          <ul className="mt-2 space-y-1 text-xs text-red-200">
            {riskManager.vetoReasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-[10px] text-zinc-500">{riskManager.proposedAction}</p>
    </section>
  );
}
