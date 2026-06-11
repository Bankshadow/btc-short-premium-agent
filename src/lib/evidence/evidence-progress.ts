import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { PNL_PENDING_MESSAGE } from "@/lib/core/trade-reconciliation";
import { listClosedTradeIds, validateTradeEvidence } from "./evidence-validator";
import type { EvidenceProgress } from "./evidence-types";
import { buildClosedTradesFromEvents } from "@/lib/trades/trade-store";

const EVIDENCE_TARGET = 12;

export async function recalculateEvidenceProgress(): Promise<EvidenceProgress> {
  const events = await getEvents();
  const tradeIds = listClosedTradeIds(events);
  const trades = tradeIds.map((id) => validateTradeEvidence(id, events));
  const validTrades = trades.filter((t) => t.status === "VALID");
  const rejectedTrades = trades.filter((t) => t.status === "REJECTED");
  const valid = Math.min(validTrades.length, EVIDENCE_TARGET);

  for (const t of trades) {
    await appendEvent({
      type: t.status === "VALID" ? "EVIDENCE_TRADE_VALIDATED" : "EVIDENCE_TRADE_REJECTED",
      environment: "testnet",
      tradeId: t.tradeId,
      payload: {
        tradeId: t.tradeId,
        rejectionReasons: t.rejectionReasons,
        validatedAt: t.validatedAt,
      },
    });
  }

  const progress: EvidenceProgress = {
    valid,
    required: EVIDENCE_TARGET,
    rejected: rejectedTrades.length,
    trades,
    readinessStatus:
      valid >= EVIDENCE_TARGET ? "COMPLETE" : rejectedTrades.length > 0 ? "BLOCKED" : "COLLECTING",
    message:
      valid >= EVIDENCE_TARGET
        ? "Evidence target reached — live remains locked."
        : `${valid}/${EVIDENCE_TARGET} valid evidence trades collected.`,
  };

  await appendEvent({
    type: "EVIDENCE_PROGRESS_UPDATED",
    environment: "testnet",
    payload: {
      valid: progress.valid,
      required: progress.required,
      rejected: progress.rejected,
      readinessStatus: progress.readinessStatus,
    },
  });

  return progress;
}

function evidenceProgressMessage(
  valid: number,
  rejectedTrades: ReturnType<typeof validateTradeEvidence>[],
): string {
  if (valid >= EVIDENCE_TARGET) {
    return "Evidence target reached — live remains locked.";
  }
  const pendingPnl = rejectedTrades.some((t) =>
    t.rejectionReasons.some((r) =>
      ["MISSING_REALIZED_PNL", "PNL_PENDING_DATA", "MISSING_ENTRY_PRICE", "MISSING_EXIT_PRICE", "ZERO_QTY"].includes(r),
    ),
  );
  const base = `${valid}/${EVIDENCE_TARGET} valid evidence trades collected.`;
  return pendingPnl ? `${base} ${PNL_PENDING_MESSAGE}` : base;
}

export function buildEvidenceProgressFromEvents(events: Awaited<ReturnType<typeof getEvents>>): EvidenceProgress {
  const closedViews = buildClosedTradesFromEvents(events);
  const closedById = new Map(closedViews.map((t) => [t.tradeId, t]));
  const tradeIds = listClosedTradeIds(events);
  const trades = tradeIds.map((id) =>
    validateTradeEvidence(id, events, closedById.get(id)),
  );
  const validTrades = trades.filter((t) => t.status === "VALID");
  const rejectedTrades = trades.filter((t) => t.status === "REJECTED");
  const valid = Math.min(validTrades.length, EVIDENCE_TARGET);
  return {
    valid,
    required: EVIDENCE_TARGET,
    rejected: rejectedTrades.length,
    trades,
    readinessStatus:
      valid >= EVIDENCE_TARGET ? "COMPLETE" : rejectedTrades.length > 0 ? "BLOCKED" : "COLLECTING",
    message: evidenceProgressMessage(valid, rejectedTrades),
  };
}

export async function getEvidenceProgressView(): Promise<EvidenceProgress> {
  const events = await getEvents();
  return buildEvidenceProgressFromEvents(events);
}
