"use client";

import type { AgentDebateRow } from "@/lib/agents/types";
import { confidenceBadgeClass, recBadgeClass } from "./agent-display";

interface MultiAgentDebateProps {
  debate: AgentDebateRow[];
}

export default function MultiAgentDebate({ debate }: MultiAgentDebateProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Multi-Agent Debate
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        TradingAgents-style panel — thesis, strategy, and risk votes vs majority.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-4 font-medium">Agent</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">View</th>
              <th className="py-2 pr-4 font-medium">Vote</th>
              <th className="py-2 pr-4 font-medium">Conf.</th>
              <th className="py-2 font-medium">Aligned</th>
            </tr>
          </thead>
          <tbody>
            {debate.map((row) => (
              <tr
                key={row.agentName}
                className="border-b border-zinc-100 dark:border-zinc-800/80"
              >
                <td className="py-2.5 pr-4 font-medium">{row.agentName}</td>
                <td className="py-2.5 pr-4 text-zinc-500">{row.strategyType}</td>
                <td className="max-w-[160px] py-2.5 pr-4 text-xs text-zinc-600 dark:text-zinc-400">
                  {row.marketView}
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${recBadgeClass(row.recommendation)}`}
                  >
                    {row.recommendation}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${confidenceBadgeClass(row.confidence)}`}
                  >
                    {row.confidence}
                  </span>
                </td>
                <td className="py-2.5">
                  {row.alignedWithMajority ? (
                    <span className="text-emerald-600">Yes</span>
                  ) : (
                    <span className="text-amber-600">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
