import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { DeskMemoryClientPayload } from "@/lib/memory/types";
import { buildDeskMemoryBuckets, flattenMemoryBullets } from "@/lib/memory/build-desk-memory";
import { buildMemoryGraph } from "./build-graph";
import { getRelevantMemory, memoryLessonsToBullets } from "./get-relevant-memory";
import type {
  MemoryGraphSnapshot,
  RelevantMemoryContext,
  RelevantMemoryResult,
} from "./types";

export function graphInputFromPayload(
  payload: DeskMemoryClientPayload | undefined,
) {
  return {
    entries: payload?.recentLogs ?? [],
    draftRules: payload?.draftRules ?? [],
    pinnedNotes: payload?.pinnedNotes ?? [],
    incidents: payload?.incidents ?? [],
    councilSessions: payload?.councilSessions ?? [],
    adaptationProposals: payload?.adaptationProposals ?? [],
    registryStrategies: payload?.registryStrategies ?? [],
  };
}

export function prepareDeskMemoryGraph(
  payload: DeskMemoryClientPayload | undefined,
  regime: string,
  riskProfile?: DeskRiskProfile,
  extraContext?: Partial<RelevantMemoryContext>,
): {
  snapshot: MemoryGraphSnapshot;
  relevant: RelevantMemoryResult;
  bullets: string[];
} {
  const snapshot = buildMemoryGraph(graphInputFromPayload(payload));
  const relevant = getRelevantMemory(snapshot, {
    marketRegime: regime,
    riskProfile,
    ...extraContext,
    limit: extraContext?.limit ?? 6,
  });

  const graphBullets = memoryLessonsToBullets(relevant.lessons);
  const fallback = flattenMemoryBullets(
    buildDeskMemoryBuckets(payload, regime),
  );
  const bullets = [...new Set([...graphBullets, ...fallback])].slice(0, 8);

  return { snapshot, relevant, bullets };
}
