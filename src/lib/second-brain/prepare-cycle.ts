import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { buildConsciousMemory } from "./build-conscious";
import { loadSecondBrainState, saveCycleSnapshot } from "./brain-store";
import { buildSecondBrainSummary, snapshotFromParts } from "./build-summary";
import { retrieveRelevantMemories, relevantLessonsToBullets } from "./retrieve-relevant";
import type {
  SecondBrainCycleSnapshot,
  SecondBrainMemorySummary,
} from "./types";

export interface PrepareSecondBrainInput {
  entries: DecisionLogEntry[];
  openPositionLabels?: string[];
  currentStrategy?: string | null;
  riskState?: string | null;
  blockers?: string[];
  marketRegime?: string | null;
  symbol?: string | null;
  workspaceId?: string;
}

export interface PrepareSecondBrainResult {
  snapshot: SecondBrainCycleSnapshot;
  summary: SecondBrainMemorySummary;
  bullets: string[];
}

export async function prepareSecondBrainForCycle(
  input: PrepareSecondBrainInput,
): Promise<PrepareSecondBrainResult> {
  const workspaceId = input.workspaceId ?? "server-default";
  const state = await loadSecondBrainState(workspaceId);
  const latest = input.entries[0] ?? null;

  const conscious = buildConsciousMemory({
    openPositionLabels: input.openPositionLabels,
    currentStrategy: input.currentStrategy,
    riskState: input.riskState,
    latestEntry: latest,
    blockers: input.blockers,
  });

  const relevant = retrieveRelevantMemories(
    state.memories,
    {
      marketRegime: input.marketRegime ?? latest?.marketRegime ?? null,
      symbol: input.symbol,
      strategy: input.currentStrategy,
      verdict: latest?.finalVerdict ?? null,
      blockers: input.blockers,
    },
    conscious,
  );

  const snapshot = snapshotFromParts(conscious, relevant);
  await saveCycleSnapshot(snapshot, conscious, workspaceId);
  const refreshed = await loadSecondBrainState(workspaceId);
  const summary = buildSecondBrainSummary(refreshed, relevant);
  const bullets = relevantLessonsToBullets(relevant);

  return { snapshot, summary, bullets };
}

export async function getSecondBrainDashboardSnapshot(workspaceId = "server-default") {
  const state = await loadSecondBrainState(workspaceId);
  const summary = buildSecondBrainSummary(state);
  return {
    state,
    summary,
    lastCycle: state.lastCycleSnapshot,
  };
}
