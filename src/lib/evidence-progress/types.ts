import type { TestnetTradeResult } from "@/lib/testnet-monitor/types";

/** MVP 73A — minimum closed testnet trades before AI performance evaluation. */
export const EVIDENCE_MVP = 73 as const;
export const EVIDENCE_MVP_LABEL = "12-Trade Evidence Monitor";

export type EvidenceLearningStatus =
  | "NONE"
  | "PENDING_REVIEW"
  | "LEARNED"
  | "EXCLUDED"
  | "REFLECTION_READY";

export interface EvidenceProgressRow {
  tradeId: string;
  symbol: string;
  side: string;
  result: TestnetTradeResult;
  netPnl: number;
  grossPnl: number;
  strategy: string | null;
  decisionLogId: string;
  closeReason: string | null;
  learningStatus: EvidenceLearningStatus;
  openedAt: string;
  closedAt: string;
  valid: true;
  evidenceIndex: number;
}

export interface EvidenceExcludedRow {
  tradeId: string;
  symbol: string;
  reason: string;
  missingDecisionLogId: boolean;
  missingCloseJournal: boolean;
  missingPnl: boolean;
  duplicate: boolean;
}

export interface EvidenceProgressSnapshot {
  mvp: typeof EVIDENCE_MVP;
  label: typeof EVIDENCE_MVP_LABEL;
  completedTrades: number;
  requiredTrades: number;
  remainingTrades: number;
  evidenceSetReady: boolean;
  evidenceSetValid: boolean;
  validityNotes: string[];
  firstTradeAt: string | null;
  latestTradeAt: string | null;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  realizedPnl: number;
  averagePnl: number;
  maxDrawdown: number;
  duplicateTradeWarnings: string[];
  missingDecisionLogId: number;
  missingCloseJournal: number;
  missingPnl: number;
  learningRecordCount: number;
  excludedTradeCount: number;
  rawClosedJournalCount: number;
  currentBlocker: string | null;
  lastCompletedTrade: EvidenceProgressRow | null;
  nextExpectedAction: string;
  validTrades: EvidenceProgressRow[];
  excludedTrades: EvidenceExcludedRow[];
  /** Live trading remains hard-blocked — evidence is testnet-only. */
  liveTradingBlocked: true;
  lastUpdatedAt: string;
}

export interface EvidenceProgressBuildInput {
  journal: import("@/lib/exchange/binance/binance-types").BinanceTestnetJournalEntry[];
  closedTrades: import("@/lib/testnet-monitor/types").TestnetClosedTrade[];
  learningRecords: import("@/lib/testnet-monitor/types").TestnetLearningRecord[];
  openPositionCount: number;
  connected: boolean;
  requiredTrades?: number;
}
