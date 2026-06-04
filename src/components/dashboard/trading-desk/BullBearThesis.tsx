"use client";

import type { AgentOutput } from "@/lib/agents/types";
import { confidenceBadgeClass, recBadgeClass } from "./agent-display";

interface BullBearThesisProps {
  bull: AgentOutput;
  bear: AgentOutput;
}

function ThesisCard({
  agent,
  accent,
}: {
  agent: AgentOutput;
  accent: "bull" | "bear";
}) {
  const border =
    accent === "bull"
      ? "border-emerald-200 dark:border-emerald-900"
      : "border-red-200 dark:border-red-900";

  return (
    <div className={`rounded-lg border p-4 ${border}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
          {agent.agentName}
        </h3>
        <div className="flex gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-bold ${recBadgeClass(agent.recommendation)}`}
          >
            {agent.recommendation}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${confidenceBadgeClass(agent.confidence)}`}
          >
            {agent.confidence}
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{agent.marketView}</p>
      <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
        {agent.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {agent.risks.length > 0 && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          Risks: {agent.risks.join(" · ")}
        </p>
      )}
      <p className="mt-3 rounded bg-zinc-50 px-2 py-1.5 text-xs dark:bg-zinc-900">
        {agent.proposedAction}
      </p>
    </div>
  );
}

export default function BullBearThesis({ bull, bear }: BullBearThesisProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Bull vs Bear Thesis
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Adversarial debate (TradingAgents-inspired) — Risk Manager challenges both
        before committee rules.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ThesisCard agent={bull} accent="bull" />
        <ThesisCard agent={bear} accent="bear" />
      </div>
    </section>
  );
}
