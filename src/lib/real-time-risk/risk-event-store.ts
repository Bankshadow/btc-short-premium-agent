import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { RealTimeRiskEvent } from "./types";

const EVENTS_FILE = "warehouse/realtime-risk-events.json";
const MAX_EVENTS = 500;

let memoryEvents: RealTimeRiskEvent[] = [];

export async function loadRiskEvents(): Promise<RealTimeRiskEvent[]> {
  const parsed = await readCronJsonFile<RealTimeRiskEvent[]>(EVENTS_FILE, []);
  memoryEvents = Array.isArray(parsed) ? parsed : [];
  return memoryEvents;
}

export async function appendRiskEvent(
  event: Omit<RealTimeRiskEvent, "eventId" | "recordedAt"> & {
    eventId?: string;
    recordedAt?: string;
  },
): Promise<RealTimeRiskEvent> {
  const entry: RealTimeRiskEvent = {
    eventId: event.eventId ?? `rte-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    recordedAt: event.recordedAt ?? new Date().toISOString(),
    eventType: event.eventType,
    severity: event.severity,
    message: event.message,
    checkId: event.checkId,
  };
  memoryEvents = [entry, ...memoryEvents].slice(0, MAX_EVENTS);
  await writeCronJsonFile(EVENTS_FILE, memoryEvents).catch(() => undefined);
  return entry;
}
