import type { JournalEvent } from "@/lib/journal/journal-types";
import { buildAgentProjection } from "./projections/agent-projection";
import { buildEvidenceProjection } from "./projections/evidence-projection";
import { buildLearningProjection } from "./projections/learning-projection";
import { buildMissionProjection } from "./projections/mission-projection";
import { buildPnlProjection } from "./projections/pnl-projection";
import { buildPositionProjection } from "./projections/position-projection";
import { buildRiskProjection } from "./projections/risk-projection";
import { buildTradeProjection } from "./projections/trade-projection";

export interface CoreProjections {
  mission: ReturnType<typeof buildMissionProjection>;
  trades: ReturnType<typeof buildTradeProjection>;
  positions: ReturnType<typeof buildPositionProjection>;
  pnl: ReturnType<typeof buildPnlProjection>;
  evidence: ReturnType<typeof buildEvidenceProjection>;
  learning: ReturnType<typeof buildLearningProjection>;
  risk: ReturnType<typeof buildRiskProjection>;
  agents: ReturnType<typeof buildAgentProjection>;
  meta: {
    eventCount: number;
    builtAt: string;
    cacheKey: string;
  };
}

let cache: { key: string; value: CoreProjections } | null = null;

function cacheKey(events: JournalEvent[]): string {
  if (events.length === 0) return "0:none";
  const last = events[0];
  return `${events.length}:${last.eventId}`;
}

export function buildAllProjections(events: JournalEvent[], options?: { bustCache?: boolean }): CoreProjections {
  const key = cacheKey(events);
  if (!options?.bustCache && cache?.key === key) {
    return cache.value;
  }

  const value: CoreProjections = {
    mission: buildMissionProjection(events),
    trades: buildTradeProjection(events),
    positions: buildPositionProjection(events),
    pnl: buildPnlProjection(events),
    evidence: buildEvidenceProjection(events),
    learning: buildLearningProjection(events),
    risk: buildRiskProjection(events),
    agents: buildAgentProjection(events),
    meta: {
      eventCount: events.length,
      builtAt: new Date().toISOString(),
      cacheKey: key,
    },
  };

  cache = { key, value };
  return value;
}

export function clearProjectionCache(): void {
  cache = null;
}

export type ProjectionId = keyof Omit<CoreProjections, "meta">;

export function buildProjectionById(id: ProjectionId, events: JournalEvent[]): CoreProjections[ProjectionId] {
  const all = buildAllProjections(events);
  return all[id];
}
