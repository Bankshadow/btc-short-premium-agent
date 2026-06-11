import type { JournalEvent } from "@/lib/journal/journal-types";
import type { CoreEvent } from "./event-types";

export type TradeLifecycleState =
  | "CREATED"
  | "ANALYZED"
  | "PREVIEWED"
  | "SAFETY_REVIEWED"
  | "EXECUTED"
  | "POSITION_OPEN"
  | "MONITORED"
  | "CLOSE_PREVIEWED"
  | "CLOSE_REVIEWED"
  | "CLOSE_EXECUTED"
  | "POSITION_CLOSED"
  | "PNL_REALIZED"
  | "LEARNING_CREATED"
  | "EVIDENCE_VALIDATED"
  | "INVALID"
  | "BLOCKED";

export type LifecycleIssueSeverity = "WARNING" | "BLOCK";

export interface LifecycleTransitionIssue {
  code: string;
  message: string;
  severity: LifecycleIssueSeverity;
  eventType?: string;
  fromState?: TradeLifecycleState;
  toState?: TradeLifecycleState;
}

export interface InvalidTransition {
  code: string;
  message: string;
  eventType: string;
  fromState: TradeLifecycleState;
  attemptedState: TradeLifecycleState;
}

export interface TradeLifecycleSnapshot {
  tradeId: string;
  state: TradeLifecycleState;
  issues: LifecycleTransitionIssue[];
  invalidTransitions: InvalidTransition[];
  lastEventType: string | null;
  lastEventAt: string | null;
  eventCount: number;
}

export interface LifecycleValidationOptions {
  /** read = historical journal scan (BLOCK → WARNING); strict = append gate */
  mode?: "read" | "strict";
}

const STATE_RANK: Record<TradeLifecycleState, number> = {
  CREATED: 0,
  ANALYZED: 1,
  PREVIEWED: 2,
  SAFETY_REVIEWED: 3,
  EXECUTED: 4,
  POSITION_OPEN: 5,
  MONITORED: 6,
  CLOSE_PREVIEWED: 7,
  CLOSE_REVIEWED: 8,
  CLOSE_EXECUTED: 9,
  POSITION_CLOSED: 10,
  PNL_REALIZED: 11,
  LEARNING_CREATED: 12,
  EVIDENCE_VALIDATED: 13,
  INVALID: -1,
  BLOCKED: -2,
};

const LIFECYCLE_EVENT_TARGET_STATE: Partial<Record<string, TradeLifecycleState>> = {
  ANALYSIS_STARTED: "ANALYZED",
  VERDICT_CREATED: "ANALYZED",
  PREVIEW_CREATED: "PREVIEWED",
  EXECUTION_REVIEWED: "SAFETY_REVIEWED",
  ORDER_EXECUTED: "EXECUTED",
  POSITION_OPENED: "POSITION_OPEN",
  POSITION_MONITORED: "MONITORED",
  CLOSE_PREVIEW_CREATED: "CLOSE_PREVIEWED",
  CLOSE_REVIEWED: "CLOSE_REVIEWED",
  CLOSE_ORDER_EXECUTED: "CLOSE_EXECUTED",
  POSITION_CLOSED: "POSITION_CLOSED",
  PNL_REALIZED: "PNL_REALIZED",
  LEARNING_RECORD_CREATED: "LEARNING_CREATED",
  EVIDENCE_TRADE_VALIDATED: "EVIDENCE_VALIDATED",
  EXECUTE_BLOCKED: "BLOCKED",
  CLOSE_BLOCKED: "BLOCKED",
};

function sortAsc(events: JournalEvent[]): JournalEvent[] {
  return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function blockIssue(
  code: string,
  message: string,
  eventType: string,
  fromState?: TradeLifecycleState,
  toState?: TradeLifecycleState,
): LifecycleTransitionIssue {
  return { code, message, severity: "BLOCK", eventType, fromState, toState };
}

function warnIssue(code: string, message: string, eventType?: string): LifecycleTransitionIssue {
  return { code, message, severity: "WARNING", eventType };
}

function hasReviewedExecution(events: JournalEvent[], previewId?: string | null): boolean {
  return events.some(
    (e) =>
      e.type === "EXECUTION_REVIEWED" &&
      (e.payload as { allowed?: boolean }).allowed === true &&
      (!previewId || e.previewId === previewId),
  );
}

function hasCloseReview(events: JournalEvent[], closePreviewId?: string | null): boolean {
  return events.some(
    (e) =>
      e.type === "CLOSE_REVIEWED" &&
      (e.payload as { allowed?: boolean }).allowed !== false &&
      (!closePreviewId || e.closePreviewId === closePreviewId),
  );
}

function toInvalidTransitions(issues: LifecycleTransitionIssue[]): InvalidTransition[] {
  return issues
    .filter((i) => i.severity === "BLOCK" && i.eventType && i.fromState && i.toState)
    .map((i) => ({
      code: i.code,
      message: i.message,
      eventType: i.eventType!,
      fromState: i.fromState!,
      attemptedState: i.toState!,
    }));
}

function linkedDecisionEvents(tradeId: string, allEvents: JournalEvent[]): JournalEvent[] {
  const tradeEvents = allEvents.filter((e) => e.tradeId === tradeId);
  const decisionLogId = tradeEvents.find((e) => e.decisionLogId)?.decisionLogId;
  if (!decisionLogId) return tradeEvents;
  const linked = allEvents.filter((e) => e.decisionLogId === decisionLogId || e.tradeId === tradeId);
  return sortAsc(linked);
}

export function deriveLifecycleState(
  tradeId: string,
  allEvents: JournalEvent[],
): TradeLifecycleSnapshot {
  return deriveTradeLifecycleState(tradeId, allEvents);
}

export function deriveTradeLifecycleState(
  tradeId: string,
  allEvents: JournalEvent[],
): TradeLifecycleSnapshot {
  const tradeScoped = sortAsc(allEvents.filter((e) => e.tradeId === tradeId));
  const contextEvents = linkedDecisionEvents(tradeId, allEvents);
  const issues: LifecycleTransitionIssue[] = [];

  if (tradeScoped.length === 0) {
    return {
      tradeId,
      state: "CREATED",
      issues: [warnIssue("NO_TRADE_EVENTS", "No trade-scoped events yet.")],
      invalidTransitions: [],
      lastEventType: null,
      lastEventAt: null,
      eventCount: 0,
    };
  }

  let state: TradeLifecycleState = "CREATED";
  const previewId =
    tradeScoped.find((e) => e.previewId)?.previewId ??
    contextEvents.find((e) => e.previewId)?.previewId ??
    null;
  const closePreviewId =
    tradeScoped.find((e) => e.closePreviewId)?.closePreviewId ?? null;

  if (contextEvents.some((e) => e.type === "ANALYSIS_STARTED" || e.type === "VERDICT_CREATED")) {
    state = "ANALYZED";
  }
  if (contextEvents.some((e) => e.type === "PREVIEW_CREATED")) {
    state = "PREVIEWED";
  }
  if (hasReviewedExecution(contextEvents, previewId)) {
    state = "SAFETY_REVIEWED";
  }

  for (const evt of tradeScoped) {
    const priorState = state;

    switch (evt.type) {
      case "EXECUTE_BLOCKED":
      case "CLOSE_BLOCKED":
        state = "BLOCKED";
        break;

      case "ORDER_EXECUTED": {
        if (!hasReviewedExecution(contextEvents, evt.previewId ?? previewId)) {
          issues.push(
            blockIssue(
              "ORDER_WITHOUT_SAFETY_REVIEW",
              "ORDER_EXECUTED without prior allowed EXECUTION_REVIEWED.",
              evt.type,
              priorState,
              "EXECUTED",
            ),
          );
          state = "INVALID";
        } else {
          state = "EXECUTED";
        }
        break;
      }

      case "POSITION_OPENED":
        if (STATE_RANK[priorState] < STATE_RANK["EXECUTED"] && priorState !== "INVALID") {
          issues.push(
            blockIssue(
              "POSITION_WITHOUT_ORDER",
              "POSITION_OPENED before ORDER_EXECUTED.",
              evt.type,
              priorState,
              "POSITION_OPEN",
            ),
          );
          state = "INVALID";
        } else if (priorState !== "INVALID" && priorState !== "BLOCKED") {
          state = "POSITION_OPEN";
        }
        break;

      case "POSITION_MONITORED":
        if (priorState !== "INVALID" && priorState !== "BLOCKED") {
          state = "MONITORED";
        }
        break;

      case "CLOSE_PREVIEW_CREATED":
        if (priorState !== "INVALID" && priorState !== "BLOCKED") {
          state = "CLOSE_PREVIEWED";
        }
        break;

      case "CLOSE_REVIEWED":
        if (priorState !== "INVALID" && priorState !== "BLOCKED") {
          state = "CLOSE_REVIEWED";
        }
        break;

      case "CLOSE_ORDER_EXECUTED": {
        if (!hasCloseReview(tradeScoped, evt.closePreviewId ?? closePreviewId)) {
          issues.push(
            warnIssue(
              "CLOSE_ORDER_WITHOUT_REVIEW",
              "CLOSE_ORDER_EXECUTED without prior CLOSE_REVIEWED (warning on read).",
              evt.type,
            ),
          );
        }
        if (priorState !== "INVALID" && priorState !== "BLOCKED") {
          state = "CLOSE_EXECUTED";
        }
        break;
      }

      case "POSITION_CLOSED": {
        const hasCloseOrder = tradeScoped.some(
          (e) => e.type === "CLOSE_ORDER_EXECUTED" && e.timestamp <= evt.timestamp,
        );
        if (!hasCloseOrder) {
          issues.push(
            blockIssue(
              "CLOSE_WITHOUT_ORDER",
              "POSITION_CLOSED without CLOSE_ORDER_EXECUTED.",
              evt.type,
              priorState,
              "POSITION_CLOSED",
            ),
          );
          state = "INVALID";
        } else {
          state = "POSITION_CLOSED";
        }
        break;
      }

      case "PNL_REALIZED": {
        const hasClosed = tradeScoped.some(
          (e) => e.type === "POSITION_CLOSED" && e.timestamp <= evt.timestamp,
        );
        if (!hasClosed) {
          issues.push(
            blockIssue(
              "PNL_WITHOUT_CLOSE",
              "PNL_REALIZED without POSITION_CLOSED.",
              evt.type,
              priorState,
              "PNL_REALIZED",
            ),
          );
          state = "INVALID";
        } else {
          state = "PNL_REALIZED";
        }
        break;
      }

      case "LEARNING_RECORD_CREATED": {
        const hasPnl = allEvents.some((e) => e.type === "PNL_REALIZED" && e.tradeId === tradeId);
        if (!hasPnl) {
          issues.push(
            blockIssue(
              "LEARNING_WITHOUT_PNL",
              "LEARNING_RECORD_CREATED without PNL_REALIZED.",
              evt.type,
              priorState,
              "LEARNING_CREATED",
            ),
          );
        } else if (priorState !== "INVALID" && priorState !== "BLOCKED") {
          state = "LEARNING_CREATED";
        }
        break;
      }

      case "EVIDENCE_TRADE_VALIDATED":
        if (priorState !== "INVALID" && priorState !== "BLOCKED") {
          state = "EVIDENCE_VALIDATED";
        }
        break;

      default:
        break;
    }

    const target = LIFECYCLE_EVENT_TARGET_STATE[evt.type];
    if (
      target &&
      priorState !== "INVALID" &&
      priorState !== "BLOCKED" &&
      STATE_RANK[target] > STATE_RANK[priorState] + 2 &&
      evt.type !== "POSITION_MONITORED"
    ) {
      issues.push(
        warnIssue(
          "SKIPPED_LIFECYCLE_STEP",
          `Event ${evt.type} may have skipped intermediate lifecycle steps from ${priorState}.`,
          evt.type,
        ),
      );
    }
  }

  const last = tradeScoped[tradeScoped.length - 1];
  const invalidTransitions = toInvalidTransitions(issues);

  return {
    tradeId,
    state,
    issues,
    invalidTransitions,
    lastEventType: last?.type ?? null,
    lastEventAt: last?.timestamp ?? null,
    eventCount: tradeScoped.length,
  };
}

/** V-008–V-011: validate a single incoming event against existing journal (strict append). */
export function validateLifecycleTransition(
  event: Pick<
    JournalEvent,
    "type" | "tradeId" | "previewId" | "closePreviewId" | "timestamp" | "decisionLogId" | "runId"
  >,
  existingEvents: JournalEvent[],
  options: LifecycleValidationOptions = {},
): LifecycleTransitionIssue[] {
  if (!event.tradeId) return [];

  const simulated: JournalEvent[] = [
    ...existingEvents,
    {
      eventId: "sim-lifecycle",
      timestamp: event.timestamp ?? new Date().toISOString(),
      type: event.type as JournalEvent["type"],
      environment: "testnet",
      tradeId: event.tradeId,
      previewId: event.previewId,
      closePreviewId: event.closePreviewId,
      decisionLogId: event.decisionLogId,
      runId: event.runId,
      payload: {},
    },
  ];

  const snapshot = deriveTradeLifecycleState(event.tradeId, simulated);
  const relevant = snapshot.issues.filter((i) => i.eventType === event.type);

  if (options.mode === "read") {
    return relevant.map((i) =>
      i.severity === "BLOCK" ? { ...i, severity: "WARNING" as const } : i,
    );
  }
  return relevant;
}

export function validateLifecycleForCoreEvent(
  event: CoreEvent,
  existingEvents: JournalEvent[],
  options: LifecycleValidationOptions = { mode: "strict" },
): LifecycleTransitionIssue[] {
  if (!event.tradeId) return [];
  return validateLifecycleTransition(
    {
      type: event.type as JournalEvent["type"],
      tradeId: event.tradeId,
      previewId: event.previewId,
      closePreviewId: event.closePreviewId,
      timestamp: event.timestamp,
    },
    existingEvents,
    options,
  );
}

export function validateAllTradeLifecycles(
  events: JournalEvent[],
  options: LifecycleValidationOptions = { mode: "read" },
): LifecycleTransitionIssue[] {
  const tradeIds = new Set<string>();
  for (const e of events) {
    if (e.tradeId) tradeIds.add(e.tradeId);
  }

  const all: LifecycleTransitionIssue[] = [];
  for (const tradeId of tradeIds) {
    const snapshot = deriveTradeLifecycleState(tradeId, events);
    for (const issue of snapshot.issues) {
      if (options.mode === "read" && issue.severity === "BLOCK") {
        all.push({ ...issue, severity: "WARNING" });
      } else {
        all.push(issue);
      }
    }
  }
  return all;
}

export function listTradeIds(events: JournalEvent[]): string[] {
  return [...new Set(events.filter((e) => e.tradeId).map((e) => e.tradeId!))];
}
