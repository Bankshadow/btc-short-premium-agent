import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { AiStatusEvent, EmitAiStatusInput } from "./types";

import { AI_STATUS_EVENT_LABELS } from "./labels";

const STORE_FILE = "ai-status-events.json";
const MAX_EVENTS = 200;

const memoryEvents: AiStatusEvent[] = [];
let activeRunId: string | null = null;

function isServer(): boolean {
  return typeof window === "undefined";
}

async function readStore(): Promise<AiStatusEvent[]> {
  if (!isServer()) return [...memoryEvents];
  const parsed = await readCronJsonFile<AiStatusEvent[]>(STORE_FILE, []);
  return Array.isArray(parsed) ? parsed : [...memoryEvents];
}

async function writeStore(events: AiStatusEvent[]): Promise<void> {
  if (!isServer()) return;
  try {
    await writeCronJsonFile(STORE_FILE, events);
  } catch {
    // memory fallback
  }
}

function eventId(): string {
  return `ais-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function getActiveAiRunId(): string | null {
  return activeRunId;
}

export async function emitAiStatusEvent(
  input: EmitAiStatusInput,
): Promise<AiStatusEvent> {
  const event: AiStatusEvent = {
    id: eventId(),
    type: input.type,
    label: input.label ?? AI_STATUS_EVENT_LABELS[input.type],
    detail: input.detail,
    timestamp: new Date().toISOString(),
    runId: input.runId ?? activeRunId,
    linkedDecisionId: input.linkedDecisionId ?? null,
    linkedTradeId: input.linkedTradeId ?? null,
    technical: input.technical,
  };

  if (input.type === "ANALYSIS_STARTED" && input.runId) {
    activeRunId = input.runId;
  }

  memoryEvents.unshift(event);
  if (memoryEvents.length > MAX_EVENTS) memoryEvents.pop();

  if (isServer()) {
    const existing = await readStore();
    const next = [event, ...existing].slice(0, MAX_EVENTS);
    await writeStore(next);
  } else if (typeof window !== "undefined") {
    try {
      const key = "btc-desk:ai-status-events";
      const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as AiStatusEvent[];
      localStorage.setItem(key, JSON.stringify([event, ...existing].slice(0, 50)));
    } catch {
      // ignore
    }
  }

  return event;
}

export async function loadAiStatusEvents(limit = 50): Promise<AiStatusEvent[]> {
  if (isServer()) {
    const events = await readStore();
    return events.slice(0, limit);
  }
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("btc-desk:ai-status-events");
      return raw ? (JSON.parse(raw) as AiStatusEvent[]).slice(0, limit) : memoryEvents.slice(0, limit);
    } catch {
      return memoryEvents.slice(0, limit);
    }
  }
  return memoryEvents.slice(0, limit);
}
