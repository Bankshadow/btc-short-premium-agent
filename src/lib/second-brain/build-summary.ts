import type {
  ConsciousMemorySnapshot,
  SecondBrainCycleSnapshot,
  SecondBrainMemorySummary,
  SecondBrainRelevantLesson,
  SecondBrainState,
} from "./types";
import { consciousToHighlights } from "./build-conscious";

export function buildSecondBrainSummary(
  state: SecondBrainState,
  relevant?: SecondBrainRelevantLesson[],
): SecondBrainMemorySummary {
  const lessons = relevant ?? state.lastCycleSnapshot?.relevantLessons ?? [];
  const subconsciousCount = state.memories.filter((m) => !m.superseded).length;
  const conscious = state.conscious ?? state.lastCycleSnapshot?.conscious ?? null;

  const topLessons = lessons.slice(0, 4).map((l) => l.lesson);
  const headline =
    lessons.length > 0
      ? `${lessons.length} lesson(s) loaded · ${subconsciousCount} stored memories`
      : subconsciousCount > 0
        ? `${subconsciousCount} memories stored — run a desk cycle to apply`
        : "Building second brain — resolve trades to store lessons";

  return {
    headline,
    consciousHighlights: conscious ? consciousToHighlights(conscious) : [],
    topLessons,
    lessonCount: lessons.length,
    subconsciousCount,
    lastConsolidatedAt: state.lastConsolidatedAt,
    lastCycleAt: state.lastCycleAt,
  };
}

export function buildCycleHeadline(
  relevant: SecondBrainRelevantLesson[],
  conscious: ConsciousMemorySnapshot,
): string {
  if (relevant.length === 0) {
    return conscious.blockers.length > 0
      ? `Second brain: clear blocker before new trades`
      : "Second brain: no prior lessons match this context";
  }
  const top = relevant[0];
  return `Second brain: ${relevant.length} lesson(s) — top: ${top.title}`;
}

export function snapshotFromParts(
  conscious: ConsciousMemorySnapshot,
  relevant: SecondBrainRelevantLesson[],
): SecondBrainCycleSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    conscious,
    relevantLessons: relevant,
    summaryHeadline: buildCycleHeadline(relevant, conscious),
    advisoryOnly: true,
    cannotBypassRisk: true,
    cannotEnableLive: true,
  };
}
