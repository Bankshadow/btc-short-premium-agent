import type { JournalEvent } from "@/lib/journal/journal-types";
import {
  CRITICAL_RECONCILIATION_CODES,
  EVIDENCE_REQUIRED_EVENTS,
  type EvidenceTradeResult,
} from "./evidence-types";

function uniqueRejectionReasons(reasons: string[]): string[] {
  return [...new Set(reasons)];
}

export function validateTradeEvidence(tradeId: string, events: JournalEvent[]): EvidenceTradeResult {
  const rejectionReasons: string[] = [];
  const validatedAt = new Date().toISOString();

  const closed = events.some((e) => e.type === "POSITION_CLOSED" && e.tradeId === tradeId);
  if (!closed) {
    return {
      tradeId,
      status: "REJECTED",
      rejectionReasons: ["TRADE_NOT_CLOSED"],
      validatedAt,
    };
  }

  for (const required of EVIDENCE_REQUIRED_EVENTS) {
    const has =
      required === "LEARNING_RECORD_CREATED"
        ? events.some(
            (e) =>
              e.tradeId === tradeId &&
              (e.type === "LEARNING_RECORD_CREATED" || e.type === "LEARNING_CREATED"),
          )
        : events.some((e) => e.type === required && e.tradeId === tradeId);
    if (!has) rejectionReasons.push(`MISSING_${required}`);
  }

  const reconWarnings = events.filter(
    (e) => e.type === "POSITION_RECONCILIATION_WARNING" && e.tradeId === tradeId,
  );
  for (const evt of reconWarnings) {
    const issues = (evt.payload as { issues?: Array<{ code?: string; severity?: string }> }).issues ?? [];
    for (const issue of issues) {
      if (issue.severity === "BLOCKED" || CRITICAL_RECONCILIATION_CODES.has(String(issue.code))) {
        rejectionReasons.push(`CRITICAL_RECONCILIATION:${issue.code}`);
      }
    }
  }

  const execReview = events.some((e) => e.type === "EXECUTION_REVIEWED" && e.tradeId === tradeId);
  if (!execReview) {
    const order = events.find((e) => e.type === "ORDER_EXECUTED" && e.tradeId === tradeId);
    const reviewByPreview = order?.previewId
      ? events.some((e) => e.type === "EXECUTION_REVIEWED" && e.previewId === order.previewId)
      : false;
    if (!reviewByPreview) rejectionReasons.push("MISSING_EXECUTION_REVIEWED");
  }

  return {
    tradeId,
    status: rejectionReasons.length === 0 ? "VALID" : "REJECTED",
    rejectionReasons: uniqueRejectionReasons(rejectionReasons),
    validatedAt,
  };
}

export function listClosedTradeIds(events: JournalEvent[]): string[] {
  return [
    ...new Set(
      events
        .filter((e) => e.type === "POSITION_CLOSED" && e.tradeId)
        .map((e) => e.tradeId as string),
    ),
  ];
}
