import { deriveTradeLifecycleState } from "@/lib/core/lifecycle-state-machine";
import { hasTradeChainEvent, resolveTradeChain } from "@/lib/journal/trade-chain";
import type { JournalEvent } from "@/lib/journal/journal-types";
import type { ClosedTrade } from "@/lib/trades/trade-types";
import { buildClosedTradesFromEvents } from "@/lib/trades/trade-store";
import {
  CRITICAL_RECONCILIATION_CODES,
  EVIDENCE_LIFECYCLE_REQUIREMENTS,
  EVENT_TO_REJECTION,
  type EvidenceLifecycleRequirement,
  type EvidenceRejectedReason,
  type EvidenceTradeValidation,
  type EvidenceTraceSummary,
} from "./evidence-types";

function uniqueReasons(reasons: EvidenceRejectedReason[]): EvidenceRejectedReason[] {
  return [...new Set(reasons)];
}

function parseQty(qty: string | undefined): number {
  const n = Math.abs(Number.parseFloat(String(qty ?? "0")));
  return Number.isFinite(n) ? n : 0;
}

function orderPayload(evt: JournalEvent) {
  return evt.payload as {
    qty?: string;
    quantity?: string;
    avgPrice?: number | string;
    entryPrice?: number;
    symbol?: string;
    side?: string;
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
    learningId?: string;
    environment?: string;
  };
}

function missingEventReason(event: EvidenceLifecycleRequirement): EvidenceRejectedReason {
  return EVENT_TO_REJECTION[event];
}

function buildTraceSummary(tradeId: string, events: JournalEvent[]): EvidenceTraceSummary {
  const presentEvents = EVIDENCE_LIFECYCLE_REQUIREMENTS.filter((req) =>
    hasTradeChainEvent(req, tradeId, events),
  );
  const missingEvents = EVIDENCE_LIFECYCLE_REQUIREMENTS.filter(
    (req) => !presentEvents.includes(req),
  );
  const lifecycle = deriveTradeLifecycleState(tradeId, events);
  const blockedCoreIssues = lifecycle.issues.filter(
    (i) =>
      i.severity === "BLOCK" &&
      i.eventType &&
      (EVIDENCE_LIFECYCLE_REQUIREMENTS as readonly string[]).includes(i.eventType),
  );
  return {
    presentEvents,
    missingEvents,
    invalidTransitions: blockedCoreIssues.map((i) => i.message),
  };
}

function detectSecretLeakage(events: JournalEvent[], tradeId: string): boolean {
  for (const evt of events.filter((e) => e.tradeId === tradeId)) {
    const apiKey = String((evt.payload as { apiKey?: string }).apiKey ?? "");
    if (apiKey.length >= 32) return true;
    const serialized = JSON.stringify(evt.payload ?? {});
    if (/sk-[a-z0-9]{10,}/i.test(serialized)) return true;
  }
  return false;
}

function isPendingPnlReason(reasons: EvidenceRejectedReason[]): boolean {
  return reasons.some((r) =>
    [
      "PNL_PENDING_DATA",
      "RESULT_PENDING_PNL",
      "MISSING_PNL_REALIZED",
      "MISSING_ENTRY_PRICE",
      "MISSING_EXIT_PRICE",
      "ZERO_QTY",
    ].includes(r),
  );
}

export interface ValidateEvidenceTradeInput {
  tradeId: string;
  events: JournalEvent[];
  closedTrade?: ClosedTrade | null;
}

export function validateEvidenceTrade(input: ValidateEvidenceTradeInput): EvidenceTradeValidation {
  const { tradeId, events, closedTrade } = input;
  const validatedAt = new Date().toISOString();
  const chain = resolveTradeChain(tradeId, events);
  const traceSummary = buildTraceSummary(tradeId, events);
  const rejectedReasons: EvidenceRejectedReason[] = [];
  const warnings: string[] = [];

  const closedEvt = events.find((e) => e.type === "POSITION_CLOSED" && e.tradeId === tradeId);
  if (!closedEvt) {
    rejectedReasons.push("TRADE_NOT_CLOSED");
    return finalizeValidation({
      tradeId,
      chain,
      closedTrade,
      closedEvt,
      events,
      rejectedReasons,
      warnings,
      traceSummary,
      validatedAt,
      status: "REJECTED",
    });
  }

  for (const required of EVIDENCE_LIFECYCLE_REQUIREMENTS) {
    if (!hasTradeChainEvent(required, tradeId, events)) {
      rejectedReasons.push(missingEventReason(required));
    }
  }
  if (rejectedReasons.some((r) => r.startsWith("MISSING_"))) {
    rejectedReasons.push("INCOMPLETE_LIFECYCLE");
  }

  const orderEvt = events.find((e) => e.type === "ORDER_EXECUTED" && e.tradeId === tradeId);
  const openEvt = events.find((e) => e.type === "POSITION_OPENED" && e.tradeId === tradeId);
  const closeOrderEvt = events.find((e) => e.type === "CLOSE_ORDER_EXECUTED" && e.tradeId === tradeId);
  const pnlEvt = events.find((e) => e.type === "PNL_REALIZED" && e.tradeId === tradeId);
  const learningEvt = events.find(
    (e) => e.type === "LEARNING_RECORD_CREATED" && e.tradeId === tradeId,
  );
  const reflectionEvt = events.find(
    (e) => e.type === "TRADE_REFLECTION_COMPLETED" && e.tradeId === tradeId,
  );

  const order = orderEvt ? orderPayload(orderEvt) : {};
  const openPayload = openEvt?.payload as { entryPrice?: number | null; qty?: string; environment?: string } | undefined;
  const qty = parseQty(order.qty ?? order.quantity ?? openPayload?.qty ?? closedTrade?.qty);
  if (qty <= 0) rejectedReasons.push("ZERO_QTY");

  const entryPrice =
    closedTrade?.entryPrice ??
    openPayload?.entryPrice ??
    (order.entryPrice != null ? Number(order.entryPrice) : null) ??
    (order.avgPrice != null ? Number(order.avgPrice) : null);
  if (entryPrice == null || !Number.isFinite(entryPrice) || entryPrice <= 0) {
    rejectedReasons.push("MISSING_ENTRY_PRICE");
  }

  let exitPrice = closedTrade?.exitPrice ?? null;
  if (pnlEvt) {
    const pnl = pnlPayload(pnlEvt);
    exitPrice = pnl.exitPrice ?? exitPrice;
    if (pnl.source === "ZERO_FILL_RECONCILIATION") rejectedReasons.push("PNL_PENDING_DATA");
    if (pnl.result === "PENDING_PNL" || pnl.status === "PENDING_DATA" || pnl.pnlStatus === "PENDING_DATA") {
      rejectedReasons.push("RESULT_PENDING_PNL");
    }
    const result = String(pnl.result ?? "");
    if (!["WIN", "LOSS", "BREAKEVEN"].includes(result)) rejectedReasons.push("PNL_PENDING_DATA");
  } else {
    rejectedReasons.push("MISSING_PNL_REALIZED");
  }

  if (closeOrderEvt) {
    const closeAvg = (closeOrderEvt.payload as { avgPrice?: number }).avgPrice;
    if (exitPrice == null && closeAvg != null) exitPrice = Number(closeAvg);
  }
  if (exitPrice == null || !Number.isFinite(exitPrice) || exitPrice <= 0) {
    rejectedReasons.push("MISSING_EXIT_PRICE");
  }

  if (closedTrade && !pnlEvt) {
    if (closedTrade.status === "CLOSED_PENDING_PNL") rejectedReasons.push("PNL_PENDING_DATA");
    if (closedTrade.result === "PENDING_PNL") rejectedReasons.push("RESULT_PENDING_PNL");
    if (closedTrade.pnlStatus === "PENDING_DATA") rejectedReasons.push("PNL_PENDING_DATA");
    if (closedTrade.pnlStatus != null && closedTrade.pnlStatus !== "REALIZED") {
      rejectedReasons.push("PNL_PENDING_DATA");
    }
  }

  const envRaw = String(closedEvt.environment ?? "testnet").toUpperCase();
  const environment =
    envRaw === "TESTNET" ? "TESTNET" : envRaw === "SIMULATION" ? "PAPER" : envRaw === "LIVE" ? "LIVE" : "UNKNOWN";
  if (environment === "LIVE") rejectedReasons.push("LIVE_ENV_BLOCKED");

  if (!chain?.runId) rejectedReasons.push("MISSING_RUN_ID");
  if (!chain?.decisionLogId) rejectedReasons.push("MISSING_DECISION_LOG_ID");
  const positionId = openEvt?.positionId ?? closedEvt.positionId ?? tradeId;
  if (!positionId) rejectedReasons.push("MISSING_POSITION_ID");

  if (!learningEvt) rejectedReasons.push("MISSING_LEARNING_RECORD");
  if (!reflectionEvt) rejectedReasons.push("MISSING_TRADE_REFLECTION");

  const reconWarnings = events.filter(
    (e) => e.type === "POSITION_RECONCILIATION_WARNING" && e.tradeId === tradeId,
  );
  for (const evt of reconWarnings) {
    const issues = (evt.payload as { issues?: Array<{ code?: string; severity?: string }> }).issues ?? [];
    for (const issue of issues) {
      if (issue.severity === "BLOCKED" || CRITICAL_RECONCILIATION_CODES.has(String(issue.code))) {
        rejectedReasons.push("CRITICAL_RECONCILIATION_ISSUE");
      }
    }
  }

  if (!chain && closedEvt) rejectedReasons.push("ORPHAN_TRADE_RECORD");

  const duplicateIds = events.filter((e) => e.tradeId === tradeId && e.type === "ORDER_EXECUTED").length;
  if (duplicateIds > 1) warnings.push("Multiple ORDER_EXECUTED events detected.");

  if (detectSecretLeakage(events, tradeId)) rejectedReasons.push("SECRET_LEAKAGE_RISK");

  const unique = uniqueReasons(rejectedReasons);
  const isValid = unique.length === 0;
  const status: EvidenceTradeValidation["status"] = isValid
    ? "VALID"
    : isPendingPnlReason(unique)
      ? "PENDING"
      : "REJECTED";

  return finalizeValidation({
    tradeId,
    chain,
    closedTrade,
    closedEvt,
    events,
    rejectedReasons: unique,
    warnings,
    traceSummary,
    validatedAt,
    status: isValid ? "VALID" : status === "PENDING" ? "PENDING" : "REJECTED",
    positionId,
    order,
    pnlEvt,
    learningEvt,
    reflectionEvt,
    environment,
    qty,
    entryPrice,
    exitPrice,
  });
}

function finalizeValidation(args: {
  tradeId: string;
  chain: ReturnType<typeof resolveTradeChain>;
  closedTrade?: ClosedTrade | null;
  closedEvt?: JournalEvent;
  events: JournalEvent[];
  rejectedReasons: EvidenceRejectedReason[];
  warnings: string[];
  traceSummary: EvidenceTraceSummary;
  validatedAt: string;
  status: EvidenceTradeValidation["status"];
  positionId?: string | null;
  order?: ReturnType<typeof orderPayload>;
  pnlEvt?: JournalEvent;
  learningEvt?: JournalEvent;
  reflectionEvt?: JournalEvent;
  environment?: EvidenceTradeValidation["environment"];
  qty?: number;
  entryPrice?: number | null;
  exitPrice?: number | null;
}): EvidenceTradeValidation {
  const pnl = args.pnlEvt ? pnlPayload(args.pnlEvt) : {};
  const learningPayload = args.learningEvt?.payload as { learningId?: string } | undefined;
  const reflectionPayload = args.reflectionEvt?.payload as { learningId?: string } | undefined;
  const isValid = args.status === "VALID";

  return {
    tradeId: args.tradeId,
    positionId: args.positionId ?? args.chain?.tradeId ?? null,
    runId: args.chain?.runId ?? null,
    decisionLogId: args.chain?.decisionLogId ?? null,
    symbol: args.closedTrade?.symbol ?? args.order?.symbol ?? null,
    side: args.closedTrade?.side ?? args.order?.side ?? null,
    environment: args.environment ?? "TESTNET",
    status: args.status,
    isValid,
    acceptedAt: isValid ? args.validatedAt : undefined,
    rejectedReasons: args.rejectedReasons,
    rejectionReasons: args.rejectedReasons,
    missingEvents: args.traceSummary.missingEvents,
    lifecycleEvents: args.traceSummary.presentEvents,
    realizedPnl: isValid ? Number(pnl.netPnl ?? args.closedTrade?.netPnl ?? 0) : null,
    result: isValid ? String(pnl.result ?? args.closedTrade?.result ?? "") : args.closedTrade?.result ?? null,
    learningId: learningPayload?.learningId ?? null,
    reflectionId: reflectionPayload?.learningId ?? null,
    traceSummary: args.traceSummary,
    warnings: args.warnings,
    createdAt: args.closedEvt?.timestamp ?? args.closedTrade?.closedAt ?? null,
    validatedAt: args.validatedAt,
  };
}

type EvidenceStatus = EvidenceTradeValidation["status"];

/** Backward-compatible wrapper */
export function validateTradeEvidence(
  tradeId: string,
  events: JournalEvent[],
  closedTrade?: ClosedTrade | null,
) {
  const closed =
    closedTrade ?? buildClosedTradesFromEvents(events).find((t) => t.tradeId === tradeId) ?? null;
  const validation = validateEvidenceTrade({ tradeId, events, closedTrade: closed });
  return {
    tradeId: validation.tradeId,
    status: validation.isValid ? ("VALID" as const) : ("REJECTED" as const),
    rejectionReasons: validation.rejectedReasons.map((r) =>
      r === "MISSING_PNL_REALIZED" ? "MISSING_REALIZED_PNL" : r,
    ),
    validatedAt: validation.validatedAt,
  };
}

export function listClosedTradeIds(events: JournalEvent[]): string[] {
  const ids = events
    .filter((e) => e.type === "POSITION_CLOSED" && e.tradeId)
    .map((e) => e.tradeId as string);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...seen];
}

export function listDuplicateTradeIds(events: JournalEvent[]): string[] {
  const counts = new Map<string, number>();
  for (const evt of events.filter((e) => e.type === "POSITION_CLOSED" && e.tradeId)) {
    counts.set(evt.tradeId!, (counts.get(evt.tradeId!) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, c]) => c > 1).map(([id]) => id);
}
