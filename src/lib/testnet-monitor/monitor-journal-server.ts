import fs from "fs/promises";
import path from "path";
import { getCronDataDir } from "@/lib/cron/cron-config";
import type { TestnetMonitorJournalEvent } from "./types";

const MONITOR_JOURNAL_FILE = "testnet-monitor-journal.json";
const MAX_EVENTS = 500;

function journalPath(): string {
  return path.join(getCronDataDir(), MONITOR_JOURNAL_FILE);
}

export async function loadMonitorJournalEvents(): Promise<
  TestnetMonitorJournalEvent[]
> {
  try {
    const raw = await fs.readFile(journalPath(), "utf8");
    const parsed = JSON.parse(raw) as TestnetMonitorJournalEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendMonitorJournalEvent(
  event: TestnetMonitorJournalEvent,
): Promise<TestnetMonitorJournalEvent[]> {
  const filePath = journalPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const next = [event, ...(await loadMonitorJournalEvents())].slice(
    0,
    MAX_EVENTS,
  );
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
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
  return event;
}
