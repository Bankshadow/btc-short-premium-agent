"use client";

import type { AgentDebateRow } from "@/lib/agents/types";
import { recBadgeClass, strategyLabel } from "./agent-display";

interface AgentDebateTableProps {
  debate: AgentDebateRow[];
}

export default function AgentDebateTable({ debate }: AgentDebateTableProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Agent Debate Table
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Strategy agents vs majority alignment before committee ruling.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-4 font-medium">Agent</th>
              <th className="py-2 pr-4 font-medium">Desk</th>
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
                <td className="py-2.5 pr-4 font-medium text-zinc-800 dark:text-zinc-200">
                  {row.agentName}
                </td>
                <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-400">
                  {strategyLabel(row.strategyType)}
                </td>
                <td className="py-2.5 pr-4 capitalize text-zinc-600 dark:text-zinc-400">
                  {row.marketView}
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${recBadgeClass(row.recommendation)}`}
                  >
                    {row.recommendation}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-400">
                  {row.confidence}%
                </td>
                <td className="py-2.5">
                  {row.alignedWithMajority ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Yes</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">No</span>
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
