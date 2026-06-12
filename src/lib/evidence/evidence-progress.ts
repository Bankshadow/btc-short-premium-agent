import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { newEventId } from "@/lib/journal/journal-types";
import { buildEvidenceProgress, buildEvidenceProgressFromEvents } from "./evidence-progress-engine";
import type { EvidenceProgress, EvidenceTradeValidation } from "./evidence-types";
import { listClosedTradeIds, validateEvidenceTrade } from "./evidence-validator";
import { buildClosedTradesFromEvents } from "@/lib/trades/trade-store";

export { buildEvidenceProgress, buildEvidenceProgressFromEvents };

function lastSummaryEvent(
  tradeId: string,
  events: Awaited<ReturnType<typeof getEvents>>,
): { type: string; payload: Record<string, unknown> } | null {
  const summary = events
    .filter(
      (e) =>
        (e.type === "EVIDENCE_TRADE_VALIDATED" || e.type === "EVIDENCE_TRADE_REJECTED") &&
        e.tradeId === tradeId,
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  return summary ? { type: summary.type, payload: summary.payload } : null;
}

function shouldWriteTradeSummary(
  validation: EvidenceTradeValidation,
  previous: { type: string; payload: Record<string, unknown> } | null,
): boolean {
  if (!previous) return true;
  const prevStatus = previous.type === "EVIDENCE_TRADE_VALIDATED" ? "VALID" : "REJECTED";
  const nextStatus = validation.isValid ? "VALID" : "REJECTED";
  if (prevStatus !== nextStatus) return true;
  const prevReasons = JSON.stringify(previous.payload.rejectionReasons ?? previous.payload.rejectedReasons ?? []);
  const nextReasons = JSON.stringify(validation.rejectedReasons);
  return prevReasons !== nextReasons;
}

export async function runEvidenceValidation(input?: {
  tradeId?: string;
  validateAll?: boolean;
  writeEvents?: boolean;
}): Promise<{
  ok: boolean;
  validationId: string;
  progress: EvidenceProgress;
  validated: EvidenceTradeValidation[];
  rejected: EvidenceTradeValidation[];
  eventsWritten: number;
}> {
  const writeEvents = input?.writeEvents !== false;
  const events = await getEvents();
  const closedViews = buildClosedTradesFromEvents(events);
  const closedById = new Map(closedViews.map((t) => [t.tradeId, t]));

  let tradeIds = listClosedTradeIds(events);
  if (input?.tradeId) {
    tradeIds = tradeIds.includes(input.tradeId) ? [input.tradeId] : [input.tradeId];
  } else if (!input?.validateAll) {
    tradeIds = tradeIds.slice(0, 1);
  }

  const validationId = newEventId("ev-val");
  let eventsWritten = 0;

  if (writeEvents) {
    await appendEvent({
      type: "EVIDENCE_VALIDATION_STARTED",
      environment: "testnet",
      payload: {
        validationId,
        tradeIds,
        validateAll: Boolean(input?.validateAll),
        safeToReplay: true,
      },
    });
    eventsWritten += 1;
  }

  const validated: EvidenceTradeValidation[] = [];
  const rejected: EvidenceTradeValidation[] = [];

  for (const tradeId of tradeIds) {
    const validation = validateEvidenceTrade({
      tradeId,
      events,
      closedTrade: closedById.get(tradeId),
    });
    if (validation.isValid) validated.push(validation);
    else rejected.push(validation);

    if (writeEvents && shouldWriteTradeSummary(validation, lastSummaryEvent(tradeId, events))) {
      await appendEvent({
        type: validation.isValid ? "EVIDENCE_TRADE_VALIDATED" : "EVIDENCE_TRADE_REJECTED",
        environment: "testnet",
        tradeId,
        runId: validation.runId ?? undefined,
        decisionLogId: validation.decisionLogId ?? undefined,
        positionId: validation.positionId ?? undefined,
        payload: {
          validationId,
          tradeId,
          isValid: validation.isValid,
          rejectedReasons: validation.rejectedReasons,
          rejectionReasons: validation.rejectionReasons,
          missingEvents: validation.missingEvents,
          safeToReplay: true,
          validatedAt: validation.validatedAt,
        },
      });
      eventsWritten += 1;
    }
  }

  const progress = buildEvidenceProgress(await getEvents());

  if (writeEvents) {
    await appendEvent({
      type: "EVIDENCE_PROGRESS_UPDATED",
      environment: "testnet",
      payload: {
        validationId,
        valid: progress.valid,
        required: progress.required,
        rejected: progress.rejected,
        pending: progress.pending,
        progressPct: progress.progressPct,
        readinessStatus: progress.readinessStatus,
        safeToReplay: true,
      },
    });
    await appendEvent({
      type: "EVIDENCE_READINESS_UPDATED",
      environment: "testnet",
      payload: {
        validationId,
        readinessStatus: progress.readinessStatus,
        blockingReasons: progress.blockingReasons,
        progressPct: progress.progressPct,
        validTrades: progress.validTrades,
        safeToReplay: true,
      },
    });
    eventsWritten += 2;
  }

  return { ok: true, validationId, progress, validated, rejected, eventsWritten };
}

export async function recalculateEvidenceProgress(): Promise<EvidenceProgress> {
  const result = await runEvidenceValidation({ validateAll: true, writeEvents: true });
  return result.progress;
}

export async function getEvidenceProgressView(): Promise<EvidenceProgress> {
  const events = await getEvents();
  return buildEvidenceProgressFromEvents(events);
}
