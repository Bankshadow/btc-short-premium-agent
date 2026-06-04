"use client";

import type { ResearchBrief } from "@/lib/research/research-types";
import { recBadgeClass, confidenceBadgeClass } from "../trading-desk/agent-display";

interface ResearchDeskPanelProps {
  research: ResearchBrief;
}

function AgentChip({
  label,
  agent,
}: {
  label: string;
  agent: ResearchBrief["marketData"];
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-200">{label}</p>
        <div className="flex gap-1">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${recBadgeClass(agent.recommendation)}`}
          >
            {agent.recommendation}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] ${confidenceBadgeClass(agent.confidence)}`}
          >
            {agent.confidence}
          </span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">{agent.marketView}</p>
      <ul className="mt-2 space-y-0.5 text-[10px] text-zinc-400">
        {agent.reasons.slice(0, 3).map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

export default function ResearchDeskPanel({ research }: ResearchDeskPanelProps) {
  const { ethCorrelation } = research;

  return (
    <section className="desk-panel border-indigo-900/40">
      <div className="border-b border-zinc-800 px-4 py-3">
        <p className="desk-section-title text-indigo-400/90">Research floor · MVP 5</p>
        <h2 className="text-sm font-semibold text-zinc-100">
          Pre-desk intelligence
        </h2>
        <p className="mt-1 flex flex-wrap gap-3 text-[10px] text-zinc-500">
          <span>Regime: {research.regimeLabel}</span>
          <span>Data quality: {research.dataQualityScore}/100</span>
          <span
            className={
              ethCorrelation.alignment === "divergent"
                ? "text-amber-400"
                : "text-zinc-500"
            }
          >
            ETH/BTC: {ethCorrelation.alignment}
          </span>
        </p>
      </div>

      <div className="grid gap-2 p-4 sm:grid-cols-2">
        <AgentChip label="Market Data" agent={research.marketData} />
        <AgentChip label="Regime" agent={research.regime} />
        <AgentChip label="Data Quality" agent={research.dataQuality} />
        <AgentChip label="Macro & News" agent={research.macroNews} />
      </div>

      <div className="border-t border-zinc-800 px-4 py-3">
        <p className="desk-section-title">Desk brief</p>
        <ul className="mt-1 space-y-1 text-xs text-zinc-400">
          {research.summaryBullets.map((b) => (
            <li key={b} className="border-l border-indigo-800 pl-2">
              {b}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
