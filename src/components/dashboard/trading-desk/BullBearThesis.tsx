"use client";

import type { AgentOutput } from "@/lib/agents/types";
import { confidenceBadgeClass, recBadgeClass } from "./agent-display";

interface BullBearThesisProps {
  bull: AgentOutput;
  bear: AgentOutput;
}

function ThesisCard({
  agent,
  side,
}: {
  agent: AgentOutput;
  side: "bull" | "bear";
}) {
  const border =
    side === "bull"
      ? "border-emerald-800/60 bg-emerald-950/20"
      : "border-rose-800/60 bg-rose-950/20";

  return (
    <div className={`rounded-lg border p-4 ${border}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">
          {agent.agentName.replace(/ Agent$/, "")}
        </h3>
        <div className="flex gap-1.5">
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-bold ${recBadgeClass(agent.recommendation)}`}
          >
            {agent.recommendation}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-[10px] ${confidenceBadgeClass(agent.confidence)}`}
          >
            {agent.confidence}
          </span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">{agent.marketView}</p>
      <ul className="mt-3 space-y-1 text-xs text-zinc-300">
        {agent.reasons.slice(0, 4).map((r) => (
          <li key={r} className="border-l-2 border-zinc-700 pl-2">
            {r}
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded bg-black/30 px-2 py-1.5 text-[10px] text-zinc-400">
        {agent.proposedAction}
      </p>
    </div>
  );
}

export default function BullBearThesis({ bull, bear }: BullBearThesisProps) {
  return (
    <section className="desk-panel p-4">
      <h2 className="text-sm font-semibold text-zinc-100">Thesis desk</h2>
      <p className="mt-0.5 text-xs text-zinc-500">Bull vs bear before risk & committee</p>
      <div className="mt-3 grid gap-3">
        <ThesisCard agent={bull} side="bull" />
        <ThesisCard agent={bear} side="bear" />
      </div>
    </section>
  );
}
