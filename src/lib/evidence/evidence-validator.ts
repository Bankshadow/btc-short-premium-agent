import { hasTradeChainEvent } from "@/lib/journal/trade-chain";
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
    if (!hasTradeChainEvent(required, tradeId, events)) {
      rejectionReasons.push(`MISSING_${required}`);
    }
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
