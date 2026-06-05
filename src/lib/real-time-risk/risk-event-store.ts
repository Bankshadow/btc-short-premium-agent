import { getCronDataDir } from "@/lib/cron/cron-config";
import type { RealTimeRiskEvent } from "./types";
import fs from "fs/promises";
import path from "path";

const EVENTS_FILE = "realtime-risk-events.json";
const MAX_EVENTS = 500;

let memoryEvents: RealTimeRiskEvent[] = [];

function eventsPath(): string {
  return path.join(getCronDataDir(), "warehouse", EVENTS_FILE);
}

export async function loadRiskEvents(): Promise<RealTimeRiskEvent[]> {
  try {
    const raw = await fs.readFile(eventsPath(), "utf8");
    const parsed = JSON.parse(raw) as RealTimeRiskEvent[];
    memoryEvents = Array.isArray(parsed) ? parsed : [];
    return memoryEvents;
  } catch {
    return memoryEvents;
  }
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
  try {
    await fs.mkdir(path.dirname(eventsPath()), { recursive: true });
    await fs.writeFile(eventsPath(), JSON.stringify(memoryEvents, null, 2), "utf8");
  } catch {
    /* memory only */
  }
  return entry;
}
