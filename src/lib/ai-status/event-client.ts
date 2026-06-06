import type { AiStatusEvent, EmitAiStatusInput } from "./types";
import { AI_STATUS_EVENT_LABELS } from "./labels";

function eventId(): string {
  return `ais-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Browser-safe AI status event append (no server fs). */
export function emitClientAiStatusEvent(input: EmitAiStatusInput): AiStatusEvent {
  const event: AiStatusEvent = {
    id: eventId(),
    type: input.type,
    label: input.label ?? AI_STATUS_EVENT_LABELS[input.type],
    detail: input.detail,
    timestamp: new Date().toISOString(),
    runId: input.runId ?? null,
    linkedDecisionId: input.linkedDecisionId ?? null,
    linkedTradeId: input.linkedTradeId ?? null,
    technical: input.technical,
  };
  if (typeof window !== "undefined") {
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
