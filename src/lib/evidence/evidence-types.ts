export type EvidenceStatus = "VALID" | "REJECTED" | "PENDING";

export type EvidenceReadinessStatus =
  | "NOT_READY"
  | "IN_PROGRESS"
  | "READY_FOR_TESTNET_CONTINUATION"
  | "READY_FOR_CONTROLLED_TESTNET_AUTO_REVIEW"
  | "BLOCKED_BY_SAFETY";

export type EvidenceRejectedReason =
  | "MISSING_ANALYSIS_STARTED"
  | "MISSING_VERDICT_CREATED"
  | "MISSING_PREVIEW_CREATED"
  | "MISSING_EXECUTION_REVIEWED"
  | "MISSING_ORDER_EXECUTED"
  | "MISSING_POSITION_OPENED"
  | "MISSING_POSITION_MONITORED"
  | "MISSING_CLOSE_ORDER_EXECUTED"
  | "MISSING_POSITION_CLOSED"
  | "MISSING_PNL_REALIZED"
  | "MISSING_TRADE_RESULT_CLASSIFIED"
  | "MISSING_LEARNING_RECORD"
  | "MISSING_TRADE_REFLECTION"
  | "PNL_PENDING_DATA"
  | "RESULT_PENDING_PNL"
  | "ZERO_QTY"
  | "MISSING_ENTRY_PRICE"
  | "MISSING_EXIT_PRICE"
  | "INVALID_LIFECYCLE_TRANSITION"
  | "CRITICAL_RECONCILIATION_ISSUE"
  | "LIVE_ENV_BLOCKED"
  | "SECRET_LEAKAGE_RISK"
  | "DUPLICATE_TRADE_ID"
  | "ORPHAN_TRADE_RECORD"
  | "MISSING_RUN_ID"
  | "MISSING_DECISION_LOG_ID"
  | "MISSING_POSITION_ID"
  | "TRADE_NOT_CLOSED"
  | "INCOMPLETE_LIFECYCLE";

/** @deprecated Use MISSING_PNL_REALIZED */
export type LegacyEvidenceReason = "MISSING_REALIZED_PNL";

export const EVIDENCE_REQUIRED_TRADES = 12;

export const EVIDENCE_LIFECYCLE_REQUIREMENTS = [
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
  "TRADE_RESULT_CLASSIFIED",
  "LEARNING_RECORD_CREATED",
  "TRADE_REFLECTION_COMPLETED",
] as const;

export type EvidenceLifecycleRequirement = (typeof EVIDENCE_LIFECYCLE_REQUIREMENTS)[number];

/** @deprecated Use EVIDENCE_LIFECYCLE_REQUIREMENTS */
export const EVIDENCE_REQUIRED_EVENTS = EVIDENCE_LIFECYCLE_REQUIREMENTS;

export const CRITICAL_RECONCILIATION_CODES = new Set([
  "MAX_OPEN_POSITIONS_EXCEEDED",
  "BINANCE_MAX_POSITIONS_EXCEEDED",
  "POSITION_STATE_UNKNOWN",
  "BINANCE_NOT_CONNECTED",
]);

export const EVENT_TO_REJECTION: Record<EvidenceLifecycleRequirement, EvidenceRejectedReason> = {
  ANALYSIS_STARTED: "MISSING_ANALYSIS_STARTED",
  VERDICT_CREATED: "MISSING_VERDICT_CREATED",
  PREVIEW_CREATED: "MISSING_PREVIEW_CREATED",
  EXECUTION_REVIEWED: "MISSING_EXECUTION_REVIEWED",
  ORDER_EXECUTED: "MISSING_ORDER_EXECUTED",
  POSITION_OPENED: "MISSING_POSITION_OPENED",
  POSITION_MONITORED: "MISSING_POSITION_MONITORED",
  CLOSE_ORDER_EXECUTED: "MISSING_CLOSE_ORDER_EXECUTED",
  POSITION_CLOSED: "MISSING_POSITION_CLOSED",
  PNL_REALIZED: "MISSING_PNL_REALIZED",
  TRADE_RESULT_CLASSIFIED: "MISSING_TRADE_RESULT_CLASSIFIED",
  LEARNING_RECORD_CREATED: "MISSING_LEARNING_RECORD",
  TRADE_REFLECTION_COMPLETED: "MISSING_TRADE_REFLECTION",
};

export interface EvidenceTraceSummary {
  presentEvents: string[];
  missingEvents: EvidenceLifecycleRequirement[];
  invalidTransitions: string[];
}

export interface EvidenceTradeValidation {
  tradeId: string;
  positionId: string | null;
  runId: string | null;
  decisionLogId: string | null;
  symbol: string | null;
  side: string | null;
  environment: "TESTNET" | "PAPER" | "LIVE" | "UNKNOWN";
  status: EvidenceStatus;
  isValid: boolean;
  acceptedAt?: string;
  rejectedReasons: EvidenceRejectedReason[];
  /** @deprecated Use rejectedReasons */
  rejectionReasons: EvidenceRejectedReason[];
  missingEvents: EvidenceLifecycleRequirement[];
  lifecycleEvents: string[];
  realizedPnl: number | null;
  result: string | null;
  learningId?: string | null;
  reflectionId?: string | null;
  traceSummary: EvidenceTraceSummary;
  warnings: string[];
  createdAt: string | null;
  validatedAt: string;
}

/** @deprecated Use EvidenceTradeValidation */
export type EvidenceTradeResult = Pick<
  EvidenceTradeValidation,
  "tradeId" | "status" | "validatedAt"
> & {
  rejectionReasons: string[];
};

export interface EvidenceValidationResult {
  validationId: string;
  tradeId: string;
  validation: EvidenceTradeValidation;
  eventsWritten: number;
}

export interface EvidenceProgress {
  required: number;
  requiredTrades: number;
  valid: number;
  validTrades: number;
  rejected: number;
  rejectedTrades: number;
  pending: number;
  pendingTrades: number;
  progressPct: number;
  readinessStatus: EvidenceReadinessStatus;
  validTradeIds: string[];
  trades: EvidenceTradeValidation[];
  rejectedList: EvidenceTradeValidation[];
  pendingList: EvidenceTradeValidation[];
  /** @deprecated Use rejectedList */
  rejectedTradeIds?: string[];
  latestValidatedAt: string | null;
  blockingReasons: EvidenceRejectedReason[];
  warnings: string[];
  message: string;
  liveLocked: true;
}

export function mapLegacyRejectionReason(reason: string): EvidenceRejectedReason {
  if (reason === "MISSING_REALIZED_PNL") return "MISSING_PNL_REALIZED";
  if (reason.startsWith("MISSING_") && reason in EVENT_TO_REJECTION) {
    return reason as EvidenceRejectedReason;
  }
  if (reason.startsWith("CRITICAL_RECONCILIATION:")) return "CRITICAL_RECONCILIATION_ISSUE";
  return reason as EvidenceRejectedReason;
}

export function evidenceReadinessLabel(status: EvidenceReadinessStatus): string {
  switch (status) {
    case "READY_FOR_TESTNET_CONTINUATION":
      return "Ready for testnet continuation (not live)";
    case "READY_FOR_CONTROLLED_TESTNET_AUTO_REVIEW":
      return "Ready for controlled testnet auto-review (not live)";
    case "IN_PROGRESS":
      return "In progress";
    case "BLOCKED_BY_SAFETY":
      return "Blocked by safety";
    default:
      return "Not ready";
  }
}
