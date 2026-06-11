import type { JournalEvent } from "./journal-types";
import { readJournalEvents, readJournalEventsSync, writeJournalEvents } from "./journal-persistence";

export { resolveJournalBackend } from "./journal-persistence";

export async function readEvents(): Promise<JournalEvent[]> {
  return readJournalEvents();
}

export function readEventsSync(): JournalEvent[] {
  return readJournalEventsSync();
}

export async function writeEvents(events: JournalEvent[]): Promise<void> {
  await writeJournalEvents(events);
}

export async function persistAppend(event: JournalEvent): Promise<JournalEvent> {
  const events = await readJournalEvents();
  events.push(event);
  await writeJournalEvents(events);
  return event;
}
