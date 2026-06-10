import type { AppendEventInput, JournalEvent } from "./journal-types";
import { newEventId } from "./journal-types";
import { persistAppend, readEvents } from "./journal-store";

export async function appendEvent(input: AppendEventInput): Promise<JournalEvent> {
  const event: JournalEvent = {
    eventId: input.eventId ?? newEventId(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    type: input.type,
    environment: input.environment,
    runId: input.runId,
    decisionLogId: input.decisionLogId,
    tradeId: input.tradeId,
    previewId: input.previewId,
    positionId: input.positionId,
    closePreviewId: input.closePreviewId,
    payload: input.payload,
  };
  return persistAppend(event);
}

export async function getEvents(): Promise<JournalEvent[]> {
  const events = await readEvents();
  return [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getEventsByRunId(runId: string): Promise<JournalEvent[]> {
  const events = await getEvents();
  return events
    .filter((e) => e.runId === runId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function getEventsByDecisionLogId(
  decisionLogId: string,
): Promise<JournalEvent[]> {
  const events = await getEvents();
  return events
    .filter((e) => e.decisionLogId === decisionLogId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
