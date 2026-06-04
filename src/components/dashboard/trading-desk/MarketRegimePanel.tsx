"use client";

import type { MarketRegimeSnapshot } from "@/lib/agents/types";
import { recBadgeClass } from "./agent-display";

interface MarketRegimePanelProps {
  regime: MarketRegimeSnapshot;
}

export default function MarketRegimePanel({ regime }: MarketRegimePanelProps) {
  const agent = regime.agent;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Market Regime
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Regime agent classifies tape before spot / futures / options vote.
      </p>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {regime.title}
          </p>
          <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            {regime.description}
          </p>
        </div>
        <span
          className={`rounded px-2.5 py-1 text-xs font-bold ${recBadgeClass(agent.recommendation)}`}
        >
          {agent.recommendation}
        </span>
      </div>

      {agent.missingData.length > 0 && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          Missing: {agent.missingData.join(", ")}
        </p>
      )}

      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        {agent.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  );
}
