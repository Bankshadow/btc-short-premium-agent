import {
  loadSecondBrainState,
  saveSecondBrainState,
  upsertMemoriesInState,
} from "@/lib/second-brain/brain-store";
import type { SecondBrainMemory } from "@/lib/second-brain/types";
import type { DailySelfReviewRecord } from "./types";

export async function appendDailyReviewLesson(
  record: DailySelfReviewRecord,
  workspaceId = "server-default",
): Promise<{ added: boolean; memoryId: string }> {
  const memoryId = `daily-review-${record.date}`;
  const state = await loadSecondBrainState(workspaceId);
  if (state.memories.some((m) => m.memoryId === memoryId && !m.superseded)) {
    return { added: false, memoryId };
  }

  const now = new Date().toISOString();
  const polarity =
    record.dailyScore >= 70 ? "positive" : record.dailyScore >= 45 ? "neutral" : "negative";

  const memory: SecondBrainMemory = {
    memoryId,
    type: "TradeLesson",
    title: `Daily self-review ${record.date} · score ${record.dailyScore}`,
    lesson: `${record.lessonLearned} Tomorrow: ${record.tomorrowPlan.slice(0, 240)}`,
    polarity,
    confidence: Math.min(0.95, 0.5 + record.dailyScore / 200),
    conflictKey: `daily-review:${record.date}`,
    tags: ["daily-self-review", "mvp-82", record.sourceCounts.missionMode.toLowerCase()],
    sourceModule: "daily-self-review",
    linkedDecisionId: null,
    linkedTradeId: null,
    createdAt: now,
    updatedAt: now,
    consolidatedAt: now,
    superseded: false,
    supersededBy: null,
  };

  const next = upsertMemoriesInState(state, [memory]);
  await saveSecondBrainState(next);
  return { added: true, memoryId };
}
