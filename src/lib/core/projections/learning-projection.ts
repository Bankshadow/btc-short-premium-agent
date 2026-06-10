import type { JournalEvent } from "@/lib/journal/journal-types";

export interface LearningProjection {
  count: number;
  tradeIds: string[];
}

export function buildLearningProjection(events: JournalEvent[]): LearningProjection {
  const tradeIds = events
    .filter((e) => e.type === "LEARNING_RECORD_CREATED" && e.tradeId)
    .map((e) => e.tradeId as string);
  return { count: tradeIds.length, tradeIds: [...new Set(tradeIds)] };
}

export function zeroLearningProjection(): LearningProjection {
  return { count: 0, tradeIds: [] };
}
