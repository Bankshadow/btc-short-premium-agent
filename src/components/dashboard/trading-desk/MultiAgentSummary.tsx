"use client";

import type { AgentOutput } from "@/lib/agents/types";
import { recBadgeClass, strategyLabel } from "./agent-display";

interface MultiAgentSummaryProps {
  agents: AgentOutput[];
}

const STRATEGY_TYPES = new Set([
  "SPOT",
  "FUTURES",
  "OPTIONS",
  "RISK",
  "PORTFOLIO",
]);

export default function MultiAgentSummary({ agents }: MultiAgentSummaryProps) {
  const strategyAgents = agents.filter((a) =>
    STRATEGY_TYPES.has(a.strategyType),
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Multi-Agent Summary
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Spot, futures, options, risk, and portfolio agents — each returns required
        / missing data and a hypothetical proposed action.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {strategyAgents.map((agent) => (
          <div
            key={agent.agentName}
            className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {agent.agentName}
              </p>
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold ${recBadgeClass(agent.recommendation)}`}
              >
                {agent.recommendation}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {strategyLabel(agent.strategyType)} · {agent.marketView} ·{" "}
              {agent.confidence}%
            </p>
            <p className="mt-2 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
              {agent.reasons[0] ?? "—"}
            </p>
            {agent.missingData.length > 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Missing: {agent.missingData.join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
