export type EvidenceStatus = "VALID" | "REJECTED";

export interface EvidenceTradeResult {
  tradeId: string;
  status: EvidenceStatus;
  rejectionReasons: string[];
  validatedAt: string;
}

export interface EvidenceProgress {
  valid: number;
  required: number;
  rejected: number;
  trades: EvidenceTradeResult[];
  readinessStatus: "COLLECTING" | "COMPLETE" | "BLOCKED";
  message: string;
}

export const EVIDENCE_REQUIRED_EVENTS = [
  "ANALYSIS_STARTED",
  "VERDICT_CREATED",
  "PREVIEW_CREATED",
  "EXECUTION_REVIEWED",
  "ORDER_EXECUTED",
  "POSITION_OPENED",
  "POSITION_MONITORED",
  "CLOSE_ORDER_EXECUTED",
  "POSITION_CLOSED",
  "PNL_REALIZED",
  "LEARNING_RECORD_CREATED",
] as const;

export const CRITICAL_RECONCILIATION_CODES = new Set([
  "MAX_OPEN_POSITIONS_EXCEEDED",
  "BINANCE_MAX_POSITIONS_EXCEEDED",
  "POSITION_STATE_UNKNOWN",
  "BINANCE_NOT_CONNECTED",
]);
