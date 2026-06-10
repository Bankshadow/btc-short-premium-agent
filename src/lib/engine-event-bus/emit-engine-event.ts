import {
  appendEngineEvent,
  newEngineEventId,
} from "./engine-event-store";
import {
  MEANINGFUL_ENGINE_EVENT_TYPES,
  type EmitEngineEventInput,
  type EngineEvent,
  type EngineEventSeverity,
} from "./types";
import { sanitizeEngineEventPayload, sanitizeEngineEventText } from "./sanitize";
import { ENGINE_EVENT_BUS_MVP } from "./types";

function defaultSeverity(type: EmitEngineEventInput["type"]): EngineEventSeverity {
  if (type === "BLOCKER_CREATED") return "critical";
  if (type === "BLOCKER_RESOLVED") return "success";
  if (type === "VERDICT_CREATED" || type === "PREVIEW_CREATED") return "success";
  if (type === "PERMISSION_REQUESTED") return "warning";
  if (type === "PNL_REALIZED" || type === "ORDER_EXECUTED") return "info";
  return "info";
}

export async function emitEngineEvent(input: EmitEngineEventInput): Promise<EngineEvent> {
  const summary = sanitizeEngineEventText(input.summary);
  const detail = sanitizeEngineEventText(input.detail ?? input.summary);
  const event: EngineEvent = {
    id: newEngineEventId(),
    mvp: ENGINE_EVENT_BUS_MVP,
    type: input.type,
    summary,
    detail,
    timestamp: new Date().toISOString(),
    runId: input.runId ?? null,
    decisionLogId: input.decisionLogId ?? null,
    tradeId: input.tradeId ?? null,
    previewId: input.previewId ?? null,
    symbol: input.symbol ?? null,
    severity: input.severity ?? defaultSeverity(input.type),
    meaningful:
      input.meaningful ??
      MEANINGFUL_ENGINE_EVENT_TYPES.has(input.type),
    liveTradingLocked: true,
    payload: sanitizeEngineEventPayload(input.payload),
  };
  return appendEngineEvent(event);
}

export async function emitEngineEvents(
  inputs: EmitEngineEventInput[],
): Promise<EngineEvent[]> {
  const out: EngineEvent[] = [];
  for (const input of inputs) {
    out.push(await emitEngineEvent(input));
  }
  return out;
}
