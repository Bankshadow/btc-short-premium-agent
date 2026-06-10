import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { TestnetLearningRecord } from "@/lib/testnet-monitor/types";
import { detectRecurringMistakes } from "./detect-recurring-mistakes";
import type {
  LearningProgressBuildInput,
  LearningProgressSnapshot,
  LearningRecordRow,
  LearningRecordStatus,
} from "./types";
import { LEARNING_QUEUE_LABEL, LEARNING_QUEUE_MVP } from "./types";

export function isClosedJournalEntry(
  entry: BinanceTestnetJournalEntry,
): boolean {
  return (
    entry.status === "CLOSED" ||
    (entry.closedAt != null && entry.realizedPnl != null)
  );
}

function toLearningStatus(
  status: TestnetLearningRecord["status"],
): LearningRecordStatus {
  if (status === "LEARNED") return "LEARNED";
  if (status === "EXCLUDED") return "EXCLUDED";
  return "PENDING_REVIEW";
}

export function mapRecordToLearningRow(
  record: TestnetLearningRecord,
): LearningRecordRow {
  return {
    tradeId: record.tradeId ?? record.closedTradeId,
    learningRecordId: record.learningRecordId,
    decisionLogId: record.decisionLogId,
    symbol: record.symbol,
    side: record.side ?? "—",
    result: record.result,
    netPnl: record.netPnl,
    strategyTag: record.strategyTag ?? record.strategy,
    aiVerdict: record.aiVerdict ?? record.finalVerdict,
    confidence: record.confidence,
    entryReason: record.entryReason,
    closeReason: record.closeReason,
    whatWorked: record.whatWorked,
    whatFailed: record.whatFailed,
    suggestedAdjustment: record.suggestedAdjustment,
    status: toLearningStatus(record.status),
    closedAt: record.createdAt,
    qualityGrade: record.qualityGrade ?? null,
    qualityScore: record.qualityScore ?? null,
  };
}

export function buildLearningProgress(
  input: LearningProgressBuildInput,
): LearningProgressSnapshot {
  const closedJournalCount = input.journal.filter(isClosedJournalEntry).length;
  const records = input.learningRecords;
  const pendingRecords = records
    .filter((r) => r.status === "PENDING_REVIEW" || r.status === "REFLECTION_READY")
    .map(mapRecordToLearningRow)
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt));
  const learnedCount = records.filter((r) => r.status === "LEARNED").length;
  const excludedCount = records.filter((r) => r.status === "EXCLUDED").length;
  const pendingCount = pendingRecords.length;
  const learningRecordCount = records.length;
  const progressPct =
    closedJournalCount > 0
      ? Math.round((learnedCount / closedJournalCount) * 100)
      : 0;

  const recentLearned = records
    .filter((r) => r.status === "LEARNED")
    .map(mapRecordToLearningRow)
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt))
    .slice(0, 8);

  const recurringMistakes = detectRecurringMistakes(records);

  let nextExpectedAction = "Close testnet trades — learning records are created automatically.";
  if (closedJournalCount > learningRecordCount) {
    nextExpectedAction = "Sync learning queue — some CLOSED journal entries lack records.";
  } else if (pendingCount > 0) {
    nextExpectedAction = `Review ${pendingCount} pending learning record(s) before strategy changes.`;
  } else if (learnedCount > 0 && closedJournalCount === learnedCount) {
    nextExpectedAction = "All closed trades learned — continue testnet cycles for evidence.";
  }

  return {
    mvp: LEARNING_QUEUE_MVP,
    label: LEARNING_QUEUE_LABEL,
    closedJournalCount,
    learningRecordCount,
    pendingCount,
    learnedCount,
    excludedCount,
    progressPct,
    pendingRecords,
    recentLearned,
    recurringMistakes,
    autoStrategyAdjustmentAllowed: false,
    strategyAdjustmentPolicy:
      "Strategy changes require evidence (12 valid trades) and operator approval — never from one trade alone.",
    nextExpectedAction,
    lastUpdatedAt: new Date().toISOString(),
  };
}
