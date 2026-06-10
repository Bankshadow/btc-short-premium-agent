import type { TestnetTradeResult } from "@/lib/testnet-monitor/types";

/** MVP 73C — closed trade learning queue. */
export const LEARNING_QUEUE_MVP = 73 as const;
export const LEARNING_QUEUE_LABEL = "Closed Trade Learning Queue";

export type LearningRecordStatus = "PENDING_REVIEW" | "LEARNED" | "EXCLUDED";

export interface LearningRecordRow {
  tradeId: string;
  learningRecordId: string;
  decisionLogId: string | null;
  symbol: string;
  side: string;
  result: TestnetTradeResult;
  netPnl: number;
  strategyTag: string | null;
  aiVerdict: string | null;
  confidence: number | null;
  entryReason: string | null;
  closeReason: string | null;
  whatWorked: string | null;
  whatFailed: string | null;
  suggestedAdjustment: string | null;
  status: LearningRecordStatus;
  closedAt: string;
  qualityGrade?: import("@/lib/trade-quality-score/types").TradeQualityGrade | null;
  qualityScore?: number | null;
}

export interface RecurringMistake {
  kind:
    | "loss_streak"
    | "repeated_close_reason"
    | "missing_decision_link"
    | "strategy_underperform"
    | "stop_loss_pattern";
  severity: "WARNING" | "CRITICAL";
  message: string;
  symbol: string | null;
  count: number;
}

export interface LearningProgressSnapshot {
  mvp: typeof LEARNING_QUEUE_MVP;
  label: typeof LEARNING_QUEUE_LABEL;
  closedJournalCount: number;
  learningRecordCount: number;
  pendingCount: number;
  learnedCount: number;
  excludedCount: number;
  progressPct: number;
  pendingRecords: LearningRecordRow[];
  recentLearned: LearningRecordRow[];
  recurringMistakes: RecurringMistake[];
  /** Never auto-adjust strategy from a single trade. */
  autoStrategyAdjustmentAllowed: false;
  strategyAdjustmentPolicy: string;
  nextExpectedAction: string;
  lastUpdatedAt: string;
}

export interface LearningProgressBuildInput {
  journal: import("@/lib/exchange/binance/binance-types").BinanceTestnetJournalEntry[];
  learningRecords: import("@/lib/testnet-monitor/types").TestnetLearningRecord[];
}
