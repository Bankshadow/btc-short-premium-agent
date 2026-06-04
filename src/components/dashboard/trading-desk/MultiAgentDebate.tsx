"use client";

import type { AgentDebateRow, AgentOutput } from "@/lib/agents/types";
import { confidenceBadgeClass, recBadgeClass } from "./agent-display";

interface MultiAgentDebateProps {
  debate: AgentDebateRow[];
  agents?: AgentOutput[];
}

export default function MultiAgentDebate({ debate, agents }: MultiAgentDebateProps) {
  return (
    <section className="desk-panel p-4">
      <h2 className="text-sm font-semibold text-zinc-100">Floor debate</h2>
      <p className="mt-0.5 text-xs text-zinc-500">
        Strategy votes vs committee majority — updated each desk session
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {debate.map((row) => {
          const detail = agents?.find((a) => a.agentName === row.agentName);
          return (
            <div
              key={row.agentName}
              className={`rounded-lg border px-3 py-2.5 ${
                row.alignedWithMajority
                  ? "border-emerald-900/50 bg-emerald-950/15"
                  : "border-amber-900/40 bg-amber-950/10"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-200">
                  {row.agentName.replace(/ Agent$/, "")}
                </span>
                <div className="flex gap-1.5">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${recBadgeClass(row.recommendation)}`}
                  >
                    {row.recommendation}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] ${confidenceBadgeClass(row.confidence)}`}
                  >
                    {row.confidence}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-[10px] uppercase text-zinc-500">
                {row.strategyType} · {row.marketView}
              </p>
              {detail?.reasons[0] && (
                <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
                  {detail.reasons[0]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
