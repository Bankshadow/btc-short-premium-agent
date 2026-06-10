import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { EngineEvent } from "./types";
import { ENGINE_EVENT_BUS_MVP } from "./types";

const JOURNAL_FILE = "engine-event-bus-journal.json";
const MAX_EVENTS = 500;

export async function loadEngineEvents(): Promise<EngineEvent[]> {
  const raw = await readCronJsonFile<EngineEvent[]>(JOURNAL_FILE, []);
  return Array.isArray(raw) ? raw : [];
}

export async function appendEngineEvents(events: EngineEvent[]): Promise<void> {
  if (events.length === 0) return;
  const existing = await loadEngineEvents();
  await writeCronJsonFile(JOURNAL_FILE, [...events, ...existing].slice(0, MAX_EVENTS));
}

export async function appendEngineEvent(event: EngineEvent): Promise<EngineEvent> {
  await appendEngineEvents([event]);
  return event;
}

export function newEngineEventId(): string {
  return `eeb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface LoadEngineEventsQuery {
  limit?: number;
  runId?: string | null;
  decisionLogId?: string | null;
  tradeId?: string | null;
  meaningfulOnly?: boolean;
  since?: string | null;
}

export async function queryEngineEvents(
  query: LoadEngineEventsQuery = {},
): Promise<{ events: EngineEvent[]; total: number }> {
  let events = await loadEngineEvents();
  if (query.runId) {
    events = events.filter((e) => e.runId === query.runId);
  }
  if (query.decisionLogId) {
    events = events.filter((e) => e.decisionLogId === query.decisionLogId);
  }
  if (query.tradeId) {
    events = events.filter((e) => e.tradeId === query.tradeId);
  }
  if (query.meaningfulOnly) {
    events = events.filter((e) => e.meaningful);
  }
  if (query.since) {
    const sinceMs = new Date(query.since).getTime();
    events = events.filter((e) => new Date(e.timestamp).getTime() > sinceMs);
  }
  const total = events.length;
  const limit = query.limit ?? 50;
  return { events: events.slice(0, limit), total };
}

/** Migrate legacy central-analysis-events into engine bus (one-time merge). */
export async function mergeLegacyCentralAnalysisEvents(
  legacy: Array<{
    id: string;
    type: string;
    detail: string;
    timestamp: string;
    linkedDecisionLogId: string | null;
  }>,
): Promise<void> {
  if (legacy.length === 0) return;
  const existing = await loadEngineEvents();
  const existingIds = new Set(existing.map((e) => e.id));
  const mapped: EngineEvent[] = legacy
    .filter((l) => !existingIds.has(l.id))
    .map((l) => ({
      id: l.id,
      mvp: ENGINE_EVENT_BUS_MVP,
      type: mapLegacyAuditType(l.type),
      summary: l.detail.slice(0, 120),
      detail: l.detail,
      timestamp: l.timestamp,
      runId: null,
      decisionLogId: l.linkedDecisionLogId,
      tradeId: null,
      previewId: null,
      symbol: null,
      severity: "info" as const,
      meaningful: false,
      liveTradingLocked: true as const,
      payload: {},
    }));
  if (mapped.length > 0) {
    await appendEngineEvents(mapped);
  }
}

function mapLegacyAuditType(type: string): EngineEvent["type"] {
  if (type === "TESTNET_PREVIEW_CANDIDATE") return "PREVIEW_CREATED";
  if (type === "RISK_BLOCKERS") return "BLOCKER_CREATED";
  if (type === "PLAYBOOK_ANALYZED") return "PLAYBOOK_COMPLETED";
  if (type === "ANALYSIS_CONTEXT_BUILT") return "CONTEXT_BUILT";
  if (type === "DECISION_LOG_PERSISTED") return "VERDICT_CREATED";
  return "REPORT_UPDATED";
}
