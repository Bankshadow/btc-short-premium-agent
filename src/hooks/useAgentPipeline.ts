"use client";

import { DESK_AGENT_PIPELINE, type DeskAgentId } from "@/lib/desk/agent-roster";
import { useEffect, useState } from "react";

export type AgentPipelineStatus = "idle" | "working" | "done";

const STEP_MS = 360;

/** Simulates agents working in sequence while analyze runs. */
export function useAgentPipeline(loading: boolean) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [completed, setCompleted] = useState<Set<DeskAgentId>>(new Set());

  useEffect(() => {
    if (!loading) {
      if (activeIndex >= 0) {
        setCompleted(new Set(DESK_AGENT_PIPELINE.map((a) => a.id)));
      }
      setActiveIndex(-1);
      return;
    }

    setCompleted(new Set());
    setActiveIndex(0);

    let idx = 0;
    const timer = setInterval(() => {
      idx += 1;
      if (idx >= DESK_AGENT_PIPELINE.length) {
        clearInterval(timer);
        setActiveIndex(DESK_AGENT_PIPELINE.length);
        setCompleted(new Set(DESK_AGENT_PIPELINE.map((a) => a.id)));
        return;
      }
      setActiveIndex(idx);
      setCompleted(
        new Set(DESK_AGENT_PIPELINE.slice(0, idx).map((a) => a.id)),
      );
    }, STEP_MS);

    return () => clearInterval(timer);
  }, [loading]);

  const statusById = (id: DeskAgentId): AgentPipelineStatus => {
    if (!loading && completed.has(id)) return "done";
    if (!loading) return "idle";
    const metaIndex = DESK_AGENT_PIPELINE.findIndex((a) => a.id === id);
    if (metaIndex < 0) return "idle";
    if (completed.has(id)) return "done";
    if (metaIndex === activeIndex) return "working";
    if (metaIndex < activeIndex) return "done";
    return "idle";
  };

  return { statusById, activeIndex, pipelineRunning: loading };
}
