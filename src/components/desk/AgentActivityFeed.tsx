"use client";

import {
  DESK_AGENT_PIPELINE,
  type DeskAgentId,
} from "@/lib/desk/agent-roster";
import type { AgentPipelineStatus } from "@/hooks/useAgentPipeline";

interface AgentActivityFeedProps {
  statusById: (id: DeskAgentId) => AgentPipelineStatus;
  activeIndex: number;
  visible: boolean;
}

export default function AgentActivityFeed({
  statusById,
  activeIndex,
  visible,
}: AgentActivityFeedProps) {
  if (!visible) return null;

  const active =
    activeIndex >= 0 && activeIndex < DESK_AGENT_PIPELINE.length
      ? DESK_AGENT_PIPELINE[activeIndex]
      : null;

  return (
    <section className="desk-panel overflow-hidden">
      <div className="border-b border-zinc-800/80 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500/90">
          Live session feed
        </p>
      </div>
      <div className="max-h-36 space-y-1 overflow-y-auto p-3 font-mono text-xs">
        {DESK_AGENT_PIPELINE.map((meta) => {
          const st = statusById(meta.id);
          const line =
            st === "working"
              ? `▸ ${meta.name} pulling Bybit tape + playbook…`
              : st === "done"
                ? `✓ ${meta.name} filed desk memo`
                : `○ ${meta.name} queued`;
          return (
            <p
              key={meta.id}
              className={
                st === "working"
                  ? "text-amber-200"
                  : st === "done"
                    ? "text-emerald-400/90"
                    : "text-zinc-600"
              }
            >
              {line}
            </p>
          );
        })}
        {active && (
          <p className="mt-2 animate-pulse text-amber-300">
            → Committee waiting on {active.name}…
          </p>
        )}
      </div>
    </section>
  );
}
