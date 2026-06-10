import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { TestnetMonitorJournalEvent } from "./types";

const MONITOR_JOURNAL_FILE = "testnet-monitor-journal.json";
const MAX_EVENTS = 500;

export async function loadMonitorJournalEvents(): Promise<
  TestnetMonitorJournalEvent[]
> {
  const parsed = await readCronJsonFile(MONITOR_JOURNAL_FILE, [] as TestnetMonitorJournalEvent[]);
  return Array.isArray(parsed) ? parsed : [];
}

export async function appendMonitorJournalEvent(
  event: TestnetMonitorJournalEvent,
): Promise<TestnetMonitorJournalEvent[]> {
  const next = [event, ...(await loadMonitorJournalEvents())].slice(
    0,
    MAX_EVENTS,
  );
  await writeCronJsonFile(MONITOR_JOURNAL_FILE, next);
  return next;
}

export function newMonitorJournalId(): string {
  return `tn-mon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function recordMonitorEvent(
  partial: Omit<TestnetMonitorJournalEvent, "journalId" | "timestamp"> & {
    timestamp?: string;
  },
): Promise<TestnetMonitorJournalEvent> {
  const event: TestnetMonitorJournalEvent = {
    journalId: newMonitorJournalId(),
    timestamp: partial.timestamp ?? new Date().toISOString(),
    exchange: partial.exchange,
    environment: partial.environment,
    eventType: partial.eventType,
    symbol: partial.symbol,
    payload: partial.payload,
    decisionLogId: partial.decisionLogId,
    orderId: partial.orderId,
    positionId: partial.positionId,
  };
  await appendMonitorJournalEvent(event);
  try {
    const { bridgeMonitorEventToEngineBus } = await import(
      "@/lib/engine-event-bus/bridge-monitor-event"
    );
    await bridgeMonitorEventToEngineBus(event);
  } catch {
    /* non-fatal */
  }
  return event;
}
