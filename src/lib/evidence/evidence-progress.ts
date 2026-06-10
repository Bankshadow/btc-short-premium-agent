import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { listClosedTradeIds, validateTradeEvidence } from "./evidence-validator";
import type { EvidenceProgress } from "./evidence-types";

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

export function buildEvidenceProgressFromEvents(events: Awaited<ReturnType<typeof getEvents>>): EvidenceProgress {
  const tradeIds = listClosedTradeIds(events);
  const trades = tradeIds.map((id) => validateTradeEvidence(id, events));
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
    message:
      valid >= EVIDENCE_TARGET
        ? "Evidence target reached — live remains locked."
        : `${valid}/${EVIDENCE_TARGET} valid evidence trades collected.`,
  };
}

export async function getEvidenceProgressView(): Promise<EvidenceProgress> {
  const events = await getEvents();
  return buildEvidenceProgressFromEvents(events);
}
