import type { JournalEvent } from "@/lib/journal/journal-types";
import { TRADE_LIFECYCLE_EVENT_TYPES } from "../event-types";
import { deriveTradeLifecycleState } from "../lifecycle-state-machine";
import { validateEvidenceTrade } from "@/lib/evidence/evidence-validator";
import { buildClosedTradesFromEvents } from "@/lib/trades/trade-store";
import type { TraceLinkKind, TraceReport, TraceStep } from "./trace-types";
import { buildAllProjections } from "../projection-engine";

function phaseForType(type: string): string {
  if (type.startsWith("ANALYSIS") || type === "VERDICT_CREATED") return "analysis";
  if (type.includes("PREVIEW")) return "preview";
  if (type.includes("EXECUTION") || type === "EXECUTE_BLOCKED") return "safety";
  if (type === "ORDER_EXECUTED" || type === "POSITION_OPENED") return "execution";
  if (type.includes("MONITOR") || type.includes("RECONCILIATION")) return "monitor";
  if (type.includes("CLOSE")) return "close";
  if (type.includes("PNL") || type.includes("RESULT")) return "pnl";
  if (type.includes("LEARNING")) return "learning";
  if (type.includes("EVIDENCE")) return "evidence";
  return "other";
}

function matchesLink(evt: JournalEvent, kind: TraceLinkKind, id: string): boolean {
  switch (kind) {
    case "runId":
      return evt.runId === id;
    case "decisionLogId":
      return evt.decisionLogId === id;
    case "tradeId":
      return evt.tradeId === id;
    case "previewId":
      return evt.previewId === id;
    case "positionId":
      return evt.positionId === id;
    case "closePreviewId":
      return evt.closePreviewId === id;
    default:
      return false;
  }
}

export function buildTraceReport(
  events: JournalEvent[],
  kind: TraceLinkKind,
  id: string,
  options?: { evidenceView?: boolean },
): TraceReport {
  const related = events
    .filter((e) => matchesLink(e, kind, id))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const steps: TraceStep[] = related.map((evt) => ({
    eventId: evt.eventId,
    type: evt.type,
    timestamp: evt.timestamp,
    summary: evt.type.replace(/_/g, " ").toLowerCase(),
    phase: phaseForType(evt.type),
  }));

  const tradeId =
    kind === "tradeId"
      ? id
      : related.find((e) => e.tradeId)?.tradeId ??
        events.find((e) => matchesLink(e, kind, id) && e.tradeId)?.tradeId ??
        null;

  const lifecycle = tradeId ? deriveTradeLifecycleState(tradeId, events) : null;

  const presentTypes = new Set(related.map((e) => e.type));
  const missingExpectedEvents = TRADE_LIFECYCLE_EVENT_TYPES.filter((t) => !presentTypes.has(t));

  const invalidTransitions = lifecycle?.issues.map((i) => i.message) ?? [];

  let recommendation = "Trace complete — review steps and projections.";
  if (lifecycle?.state === "BLOCKED") {
    recommendation = "Trade blocked — resolve operator/risk issues before retry.";
  } else if (invalidTransitions.length > 0) {
    recommendation = "Lifecycle integrity issues detected — run core replay validation.";
  } else if (missingExpectedEvents.length > 5) {
    recommendation = "Lifecycle incomplete — continue next loop stage.";
  }

  buildAllProjections(events);

  let evidenceValidation = null;
  let evidenceMissingEvents: string[] | undefined;
  let evidenceRejectedReasons: string[] | undefined;
  let readinessImpact: string | null = null;

  if (options?.evidenceView && tradeId) {
    const closed = buildClosedTradesFromEvents(events).find((t) => t.tradeId === tradeId) ?? null;
    evidenceValidation = validateEvidenceTrade({ tradeId, events, closedTrade: closed });
    evidenceMissingEvents = evidenceValidation.missingEvents;
    evidenceRejectedReasons = evidenceValidation.rejectedReasons;
    readinessImpact = evidenceValidation.isValid
      ? "Counts toward 12-trade evidence target."
      : evidenceValidation.status === "PENDING"
        ? "Pending PnL — does not count toward evidence."
        : "Rejected — does not count toward evidence.";
  }

  return {
    linkKind: kind,
    linkId: id,
    steps,
    lifecycleState: lifecycle?.state ?? null,
    missingExpectedEvents,
    invalidTransitions,
    recommendation,
    liveLocked: true,
    evidenceValidation,
    evidenceMissingEvents,
    evidenceRejectedReasons,
    readinessImpact,
  };
}

export function detectTraceLinkKind(id: string, events: JournalEvent[]): TraceLinkKind | null {
  const kinds: TraceLinkKind[] = [
    "tradeId",
    "runId",
    "decisionLogId",
    "previewId",
    "positionId",
    "closePreviewId",
  ];
  for (const kind of kinds) {
    if (events.some((e) => matchesLink(e, kind, id))) return kind;
  }
  if (id.startsWith("trade-")) return "tradeId";
  if (id.startsWith("run-")) return "runId";
  if (id.startsWith("dl-")) return "decisionLogId";
  if (id.startsWith("prev-") || id.startsWith("preview-")) return "previewId";
  return null;
}
