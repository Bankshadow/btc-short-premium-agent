import type { JournalEvent } from "@/lib/journal/journal-types";
import { PNL_PENDING_MESSAGE } from "@/lib/core/trade-reconciliation";
import { buildClosedTradesFromEvents } from "@/lib/trades/trade-store";
import {
  EVIDENCE_REQUIRED_TRADES,
  type EvidenceProgress,
  type EvidenceReadinessStatus,
  type EvidenceRejectedReason,
  type EvidenceTradeValidation,
} from "./evidence-types";
import {
  listClosedTradeIds,
  listDuplicateTradeIds,
  validateEvidenceTrade,
} from "./evidence-validator";

function isPendingValidation(v: EvidenceTradeValidation): boolean {
  return (
    v.status === "PENDING" ||
    v.rejectedReasons.some((r) =>
      [
        "PNL_PENDING_DATA",
        "RESULT_PENDING_PNL",
        "MISSING_PNL_REALIZED",
        "MISSING_ENTRY_PRICE",
        "MISSING_EXIT_PRICE",
        "ZERO_QTY",
      ].includes(r),
    )
  );
}

function deriveReadinessStatus(input: {
  validTrades: number;
  blockingReasons: EvidenceRejectedReason[];
}): EvidenceReadinessStatus {
  if (
    input.blockingReasons.includes("CRITICAL_RECONCILIATION_ISSUE") ||
    input.blockingReasons.includes("LIVE_ENV_BLOCKED") ||
    input.blockingReasons.includes("SECRET_LEAKAGE_RISK")
  ) {
    return "BLOCKED_BY_SAFETY";
  }
  if (input.validTrades >= EVIDENCE_REQUIRED_TRADES) {
    return "READY_FOR_TESTNET_CONTINUATION";
  }
  if (input.validTrades > 0) {
    return "IN_PROGRESS";
  }
  return "NOT_READY";
}

function buildMessage(valid: number, pending: number, readiness: EvidenceReadinessStatus): string {
  const base = `${valid}/${EVIDENCE_REQUIRED_TRADES} valid evidence trades collected.`;
  if (readiness === "READY_FOR_TESTNET_CONTINUATION") {
    return `${base} Testnet continuation ready — live remains locked.`;
  }
  if (pending > 0) {
    return `${base} ${PNL_PENDING_MESSAGE}`;
  }
  return `${base} Evidence requires full lifecycle: execution, close, realized PnL, and learning.`;
}

export function buildEvidenceProgress(events: JournalEvent[]): EvidenceProgress {
  const closedViews = buildClosedTradesFromEvents(events);
  const closedById = new Map(closedViews.map((t) => [t.tradeId, t]));
  const tradeIds = listClosedTradeIds(events);
  const duplicateTradeIds = listDuplicateTradeIds(events);

  const trades = tradeIds.map((id) =>
    validateEvidenceTrade({ tradeId: id, events, closedTrade: closedById.get(id) }),
  );

  for (const tradeId of duplicateTradeIds) {
    const existing = trades.find((t) => t.tradeId === tradeId);
    if (existing && !existing.rejectedReasons.includes("DUPLICATE_TRADE_ID")) {
      existing.rejectedReasons.push("DUPLICATE_TRADE_ID");
      existing.rejectionReasons.push("DUPLICATE_TRADE_ID");
      existing.isValid = false;
      existing.status = "REJECTED";
    }
  }

  const validList = trades.filter((t) => t.isValid);
  const pendingList = trades.filter((t) => !t.isValid && isPendingValidation(t));
  const rejectedList = trades.filter((t) => !t.isValid && !isPendingValidation(t));

  const validTrades = validList.length;
  const pendingTrades = pendingList.length;
  const rejectedTrades = trades.filter((t) => !t.isValid).length;
  const progressPct = Number(((validTrades / EVIDENCE_REQUIRED_TRADES) * 100).toFixed(2));

  const blockingReasons = uniqueBlockingReasons(trades);
  const readinessStatus = deriveReadinessStatus({ validTrades, blockingReasons });
  const latestValidatedAt =
    trades.length > 0
      ? trades.map((t) => t.validatedAt).sort((a, b) => b.localeCompare(a))[0]
      : null;

  const warnings = trades.flatMap((t) => t.warnings);

  return {
    required: EVIDENCE_REQUIRED_TRADES,
    requiredTrades: EVIDENCE_REQUIRED_TRADES,
    valid: validTrades,
    validTrades,
    rejected: rejectedTrades,
    rejectedTrades,
    pending: pendingTrades,
    pendingTrades,
    progressPct,
    readinessStatus,
    validTradeIds: validList.map((t) => t.tradeId),
    trades,
    rejectedList: trades.filter((t) => !t.isValid),
    pendingList,
    latestValidatedAt,
    blockingReasons,
    warnings: [...new Set(warnings)],
    message: buildMessage(validTrades, pendingTrades, readinessStatus),
    liveLocked: true,
  };
}

function uniqueBlockingReasons(trades: EvidenceTradeValidation[]): EvidenceRejectedReason[] {
  const reasons = new Set<EvidenceRejectedReason>();
  for (const trade of trades) {
    for (const reason of trade.rejectedReasons) {
      if (
        [
          "CRITICAL_RECONCILIATION_ISSUE",
          "LIVE_ENV_BLOCKED",
          "SECRET_LEAKAGE_RISK",
          "INVALID_LIFECYCLE_TRANSITION",
          "DUPLICATE_TRADE_ID",
        ].includes(reason)
      ) {
        reasons.add(reason);
      }
    }
  }
  return [...reasons];
}

export function buildEvidenceProgressFromEvents(events: JournalEvent[]): EvidenceProgress {
  return buildEvidenceProgress(events);
}
