import type { AgentScoreboard, AgentScoreEntry } from "@/lib/agents/agent-score-types";
import type { JournalEvent } from "@/lib/journal/journal-types";

function scoresFromEvents(events: JournalEvent[]): Map<string, AgentScoreEntry> {
  const map = new Map<string, AgentScoreEntry>();
  for (const evt of events.filter((e) => e.type === "AGENT_SCORE_UPDATED")) {
    const p = evt.payload as unknown as AgentScoreEntry;
    map.set(p.agentId, p);
  }
  return map;
}

export function buildAgentProjection(events: JournalEvent[]): AgentScoreboard {
  const scores = scoresFromEvents(events);
  return {
    generatedAt: new Date().toISOString(),
    agents: [...scores.values()].sort((a, b) => b.predictionAccuracy - a.predictionAccuracy),
    advisoryOnly: true,
    liveLocked: true,
    message: "Agent scores are advisory — not applied to execution weights.",
  };
}

export function zeroAgentProjection(): AgentScoreboard {
  return buildAgentProjection([]);
}
