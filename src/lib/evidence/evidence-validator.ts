import { hasTradeChainEvent } from "@/lib/journal/trade-chain";
import type { JournalEvent } from "@/lib/journal/journal-types";
import type { ClosedTrade } from "@/lib/trades/trade-types";
import {
  CRITICAL_RECONCILIATION_CODES,
  EVIDENCE_REQUIRED_EVENTS,
  type EvidenceTradeResult,
} from "./evidence-types";

function uniqueRejectionReasons(reasons: string[]): string[] {
  return [...new Set(reasons)];
}

function orderPayload(evt: JournalEvent) {
  return evt.payload as {
    qty?: string;
    quantity?: string;
    avgPrice?: number | string;
    entryPrice?: number;
  };
}

function pnlPayload(evt: JournalEvent) {
  return evt.payload as {
    netPnl?: number;
    result?: string;
    entryPrice?: number;
    exitPrice?: number;
    qty?: string;
    source?: string;
    status?: string;
    pnlStatus?: string;
  };
}

function parseQty(qty: string | undefined): number {
  const n = Math.abs(Number.parseFloat(String(qty ?? "0")));
  return Number.isFinite(n) ? n : 0;
}

function applyClosedTradeProjectionChecks(
  closedTrade: ClosedTrade | null | undefined,
  rejectionReasons: string[],
): void {
  if (!closedTrade) return;

  if (closedTrade.status === "CLOSED_PENDING_PNL") {
    rejectionReasons.push("PNL_PENDING_DATA");
  }
  if (closedTrade.result === "PENDING_PNL") {
    rejectionReasons.push("PNL_PENDING_DATA");
  }
  if (closedTrade.pnlStatus === "PENDING_DATA") {
    rejectionReasons.push("PNL_PENDING_DATA");
  }
  if (closedTrade.status !== "CLOSED") {
    rejectionReasons.push("PNL_PENDING_DATA");
  }
  if (closedTrade.entryPrice == null || !Number.isFinite(closedTrade.entryPrice)) {
    rejectionReasons.push("MISSING_ENTRY_PRICE");
  }
  if (closedTrade.exitPrice == null || !Number.isFinite(closedTrade.exitPrice)) {
    rejectionReasons.push("MISSING_EXIT_PRICE");
  }
  if (parseQty(closedTrade.qty) <= 0) {
    rejectionReasons.push("ZERO_QTY");
  }
  if (!["WIN", "LOSS", "BREAKEVEN"].includes(String(closedTrade.result ?? ""))) {
    rejectionReasons.push("PNL_PENDING_DATA");
  }
  if (closedTrade.pnlStatus != null && closedTrade.pnlStatus !== "REALIZED") {
    rejectionReasons.push("PNL_PENDING_DATA");
  }
}

function applyStrictEvidenceQualityChecks(
  tradeId: string,
  events: JournalEvent[],
  rejectionReasons: string[],
): void {
  const pnlEvt = events.find((e) => e.type === "PNL_REALIZED" && e.tradeId === tradeId);
  if (!pnlEvt) {
    rejectionReasons.push("MISSING_REALIZED_PNL");
  }

  const orderEvt = events.find((e) => e.type === "ORDER_EXECUTED" && e.tradeId === tradeId);
  const openEvt = events.find((e) => e.type === "POSITION_OPENED" && e.tradeId === tradeId);
  const closeOrderEvt = events.find(
    (e) => e.type === "CLOSE_ORDER_EXECUTED" && e.tradeId === tradeId,
  );
  const closedEvt = events.find((e) => e.type === "POSITION_CLOSED" && e.tradeId === tradeId);

  const order = orderEvt ? orderPayload(orderEvt) : {};
  const openPayload = openEvt?.payload as { entryPrice?: number | null; qty?: string } | undefined;
  const qty = parseQty(order.qty ?? order.quantity ?? openPayload?.qty);
  if (qty <= 0) {
    rejectionReasons.push("ZERO_QTY");
  }

  const entryPrice =
    openPayload?.entryPrice ??
    (order.entryPrice != null ? Number(order.entryPrice) : null) ??
    (order.avgPrice != null ? Number(order.avgPrice) : null);
  if (entryPrice == null || !Number.isFinite(entryPrice) || entryPrice <= 0) {
    rejectionReasons.push("MISSING_ENTRY_PRICE");
  }

  if (pnlEvt) {
    const pnl = pnlPayload(pnlEvt);
    if (pnl.source === "ZERO_FILL_RECONCILIATION") {
      rejectionReasons.push("PNL_PENDING_DATA");
    }
    if (pnl.result === "PENDING_PNL" || pnl.status === "PENDING_DATA" || pnl.pnlStatus === "PENDING_DATA") {
      rejectionReasons.push("PNL_PENDING_DATA");
    }
    const exitPrice =
      pnl.exitPrice ??
      (closeOrderEvt
        ? Number((closeOrderEvt.payload as { avgPrice?: number }).avgPrice)
        : null);
    if (exitPrice == null || !Number.isFinite(exitPrice) || exitPrice <= 0) {
      rejectionReasons.push("MISSING_EXIT_PRICE");
    }
    const result = String(pnl.result ?? "");
    if (!["WIN", "LOSS", "BREAKEVEN"].includes(result)) {
      rejectionReasons.push("PNL_PENDING_DATA");
    }
  } else if (closedEvt) {
    const closedPayload = closedEvt.payload as {
      realizedPnlPending?: boolean;
      source?: string;
    };
    if (closedPayload.realizedPnlPending || closedPayload.source === "RECONCILIATION_BACKFILL") {
      rejectionReasons.push("PNL_PENDING_DATA");
    }
  }

  if (!hasTradeChainEvent("LEARNING_RECORD_CREATED", tradeId, events)) {
    rejectionReasons.push("MISSING_LEARNING_RECORD");
  }
}

export function validateTradeEvidence(
  tradeId: string,
  events: JournalEvent[],
  closedTrade?: ClosedTrade | null,
): EvidenceTradeResult {
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

  let lifecycleIncomplete = false;
  for (const required of EVIDENCE_REQUIRED_EVENTS) {
    if (!hasTradeChainEvent(required, tradeId, events)) {
      lifecycleIncomplete = true;
      if (required === "PNL_REALIZED") {
        rejectionReasons.push("MISSING_REALIZED_PNL");
      } else if (required === "LEARNING_RECORD_CREATED") {
        rejectionReasons.push("MISSING_LEARNING_RECORD");
      } else {
        rejectionReasons.push(`MISSING_${required}`);
      }
    }
  }
  if (lifecycleIncomplete) {
    rejectionReasons.push("INCOMPLETE_LIFECYCLE");
  }

  applyStrictEvidenceQualityChecks(tradeId, events, rejectionReasons);
  applyClosedTradeProjectionChecks(closedTrade, rejectionReasons);

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

  const unique = uniqueRejectionReasons(rejectionReasons);

  return {
    tradeId,
    status: unique.length === 0 ? "VALID" : "REJECTED",
    rejectionReasons: unique,
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
