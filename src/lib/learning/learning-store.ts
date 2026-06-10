import { getEvents } from "@/lib/journal/journal-query";
import type { LearningRecord } from "./learning-types";

function recordFromEvent(evt: {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}): LearningRecord | null {
  if (evt.type !== "LEARNING_RECORD_CREATED" && evt.type !== "LEARNING_CREATED") return null;
  const p = evt.payload as Partial<LearningRecord>;
  if (!p.learningId || !p.tradeId) return null;
  return {
    ...(p as LearningRecord),
    createdAt: p.createdAt ?? evt.timestamp,
  };
}

export async function getAllLearningRecords(): Promise<LearningRecord[]> {
  const events = await getEvents();
  return events
    .filter((e) => e.type === "LEARNING_RECORD_CREATED")
    .map(recordFromEvent)
    .filter((r): r is LearningRecord => r != null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLearningByTradeId(tradeId: string): Promise<LearningRecord | null> {
  const records = await getAllLearningRecords();
  return records.find((r) => r.tradeId === tradeId) ?? null;
}

export async function hasLearningRecord(tradeId: string): Promise<boolean> {
  const events = await getEvents();
  return events.some(
    (e) =>
      (e.type === "LEARNING_RECORD_CREATED" || e.type === "LEARNING_CREATED") &&
      e.tradeId === tradeId,
  );
}

export function summarizeLearning(records: LearningRecord[]) {
  const mistakes = records.filter((r) => r.tradeResult === "LOSS").map((r) => r.avoidNextTime);
  const strengths = records.filter((r) => r.tradeResult === "WIN").map((r) => r.repeatNextTime);
  return {
    count: records.length,
    latestLessons: records.slice(0, 5).map((r) => ({
      tradeId: r.tradeId,
      lesson: r.whatWorked || r.whatFailed,
      result: r.tradeResult,
    })),
    repeatedMistakes: [...new Set(mistakes)].slice(0, 5),
    repeatedStrengths: [...new Set(strengths)].slice(0, 5),
  };
}
