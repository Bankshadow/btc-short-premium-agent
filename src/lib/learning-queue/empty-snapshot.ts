import type { LearningProgressSnapshot } from "./types";
import { LEARNING_QUEUE_LABEL, LEARNING_QUEUE_MVP } from "./types";

/** Client-safe default — no fs/cron imports. */
export function emptyLearningProgress(): LearningProgressSnapshot {
  return {
    mvp: LEARNING_QUEUE_MVP,
    label: LEARNING_QUEUE_LABEL,
    closedJournalCount: 0,
    learningRecordCount: 0,
    pendingCount: 0,
    learnedCount: 0,
    excludedCount: 0,
    progressPct: 0,
    pendingRecords: [],
    recentLearned: [],
    recurringMistakes: [],
    autoStrategyAdjustmentAllowed: false,
    strategyAdjustmentPolicy:
      "Strategy changes require evidence (12 valid trades) and operator approval — never from one trade alone.",
    nextExpectedAction: "Close testnet trades — learning records are created automatically.",
    lastUpdatedAt: new Date().toISOString(),
  };
}
