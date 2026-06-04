"use client";

import type { TradingDeskOutput } from "@/lib/agents/types";
import {
  accentBgClass,
  accentRingClass,
  agentOutputToId,
  DESK_AGENT_PIPELINE,
  type DeskAgentId,
} from "@/lib/desk/agent-roster";
import type { AgentPipelineStatus } from "@/hooks/useAgentPipeline";
import { recBadgeClass } from "@/components/dashboard/trading-desk/agent-display";

interface AgentRosterProps {
  desk: TradingDeskOutput | null;
  statusById: (id: DeskAgentId) => AgentPipelineStatus;
  pipelineRunning: boolean;
}

function statusLabel(status: AgentPipelineStatus, hasVote: boolean): string {
  if (status === "working") return "Analyzing…";
  if (status === "done" || hasVote) return "Reported";
  return "Standby";
}

function statusDot(status: AgentPipelineStatus): string {
  if (status === "working") return "bg-amber-400 animate-pulse";
  if (status === "done") return "bg-emerald-400";
  return "bg-zinc-600";
}

export default function AgentRoster({
  desk,
  statusById,
  pipelineRunning,
}: AgentRosterProps) {
  const outputsById = new Map<
    DeskAgentId,
    NonNullable<TradingDeskOutput>["agents"][number]
  >();
  if (desk) {
    for (const agent of desk.agents) {
      const id = agentOutputToId(agent);
      if (id) outputsById.set(id, agent);
    }
  }

  const committee = desk?.committee;

  return (
    <aside className="desk-panel flex h-full flex-col">
      <div className="border-b border-zinc-800/80 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Trading floor
        </h2>
        <p className="mt-0.5 text-sm text-zinc-300">Agent roster</p>
      </div>

      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {DESK_AGENT_PIPELINE.map((meta) => {
          const pipelineStatus = statusById(meta.id);
          const output =
            meta.id === "committee"
              ? null
              : outputsById.get(meta.id);
          const hasVote = Boolean(output || (meta.id === "committee" && committee));
          const status =
            pipelineRunning && pipelineStatus !== "idle"
              ? pipelineStatus
              : hasVote
                ? "done"
                : pipelineRunning
                  ? "working"
                  : "idle";

          const rec =
            meta.id === "committee"
              ? committee?.finalVerdict
              : output?.recommendation;
          const veto =
            meta.id === "risk" && desk?.riskManager.veto;

          return (
            <li
              key={meta.id}
              className={`rounded-lg border border-transparent px-2 py-2 transition ${
                status === "working"
                  ? `border-amber-500/30 bg-amber-950/20 ring-1 ${accentRingClass(meta.accent)}`
                  : "hover:bg-zinc-900/60"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${accentBgClass(meta.accent)}`}
                >
                  {meta.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {meta.name}
                    </p>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${statusDot(status)}`}
                      title={statusLabel(status, hasVote)}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    {meta.desk} · {meta.role}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-zinc-500">
                      {statusLabel(status, hasVote)}
                    </span>
                    {rec && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${recBadgeClass(rec)}`}
                      >
                        {rec}
                      </span>
                    )}
                    {veto && (
                      <span className="rounded bg-red-950 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
                        VETO
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-zinc-800/80 p-3 text-[10px] leading-relaxed text-zinc-500">
        Agents run automatically on load and every few minutes. Human approval
        required before any real trade.
      </div>
    </aside>
  );
}
