import type { JournalEvent } from "@/lib/journal/journal-types";
import type { EventValidationIssue } from "./core-errors";
import {
  CORE_EVENT_SCHEMA_VERSION,
  CORE_EVENT_VERSION,
  CORE_META_PAYLOAD_KEY,
  type CoreEvent,
  type CoreEventEnvironment,
  type CoreEventSource,
  mapJournalEnvironmentToCore,
} from "./event-types";

export interface NormalizationResult {
  event: CoreEvent;
  warnings: EventValidationIssue[];
}

function warn(code: string, message: string, field?: string): EventValidationIssue {
  return { code, message, severity: "WARNING", field };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function readString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" && v.trim() ? v : undefined;
}

function inferSource(raw: Record<string, unknown>, payloadMeta?: Record<string, unknown>): CoreEventSource {
  const top = readString(raw, "source");
  if (
    top === "SYSTEM" ||
    top === "USER" ||
    top === "AGENT" ||
    top === "EXCHANGE" ||
    top === "OPERATOR"
  ) {
    return top;
  }
  const metaCreatedBy = payloadMeta?.createdBy;
  if (
    metaCreatedBy === "SYSTEM" ||
    metaCreatedBy === "USER" ||
    metaCreatedBy === "AGENT" ||
    metaCreatedBy === "EXCHANGE" ||
    metaCreatedBy === "OPERATOR"
  ) {
    return metaCreatedBy as CoreEventSource;
  }
  return "SYSTEM";
}

function inferEnvironment(raw: Record<string, unknown>): CoreEventEnvironment {
  const top = readString(raw, "environment");
  if (
    top === "TESTNET" ||
    top === "PAPER" ||
    top === "LIVE_DISABLED" ||
    top === "UNKNOWN"
  ) {
    return top;
  }
  return mapJournalEnvironmentToCore(top);
}

function buildMetadata(
  raw: Record<string, unknown>,
  payload: Record<string, unknown>,
  runId: string | undefined,
  warnings: EventValidationIssue[],
): CoreEvent["metadata"] {
  const payloadMetaRaw = payload[CORE_META_PAYLOAD_KEY];
  const payloadMeta = isRecord(payloadMetaRaw) ? payloadMetaRaw : undefined;
  const topMeta = isRecord(raw.metadata) ? raw.metadata : undefined;

  const schemaVersion =
    readString(topMeta ?? {}, "schemaVersion") ??
    (payloadMeta?.schemaVersion != null ? String(payloadMeta.schemaVersion) : undefined) ??
    CORE_EVENT_SCHEMA_VERSION;

  if (!topMeta?.schemaVersion && !payloadMeta?.schemaVersion) {
    warnings.push(
      warn(
        "METADATA_SCHEMA_INFERRED",
        "metadata.schemaVersion was missing; assigned core-event-v1.",
        "metadata.schemaVersion",
      ),
    );
  }

  if (!topMeta?.createdBy && !payloadMeta?.createdBy && !readString(raw, "source")) {
    warnings.push(
      warn(
        "METADATA_CREATED_BY_INFERRED",
        "metadata.createdBy was missing; defaulted to SYSTEM.",
        "metadata.createdBy",
      ),
    );
  }

  const safeToReplay =
    typeof topMeta?.safeToReplay === "boolean"
      ? topMeta.safeToReplay
      : typeof payloadMeta?.safeToReplay === "boolean"
        ? payloadMeta.safeToReplay
        : true;

  if (topMeta?.safeToReplay === undefined && payloadMeta?.safeToReplay === undefined) {
    warnings.push(
      warn(
        "METADATA_SAFE_TO_REPLAY_INFERRED",
        "metadata.safeToReplay was missing; defaulted to true.",
        "metadata.safeToReplay",
      ),
    );
  }

  return {
    correlationId:
      readString(topMeta ?? {}, "correlationId") ??
      readString(payloadMeta ?? {}, "correlationId") ??
      runId,
    causationId:
      readString(topMeta ?? {}, "causationId") ??
      readString(payloadMeta ?? {}, "causationId"),
    schemaVersion,
    createdBy: inferSource(raw, payloadMeta),
    safeToReplay,
  };
}

function stripCoreMetaFromPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const { [CORE_META_PAYLOAD_KEY]: _meta, ...rest } = payload;
  return rest;
}

/**
 * Normalize legacy journal events or partial inputs into canonical CoreEvent shape.
 * Never throws — missing fields are inferred with warnings.
 */
export function normalizeToCoreEvent(rawEvent: unknown): NormalizationResult {
  const warnings: EventValidationIssue[] = [];

  if (!isRecord(rawEvent)) {
    return {
      event: {
        eventId: "",
        type: "",
        timestamp: "",
        version: CORE_EVENT_VERSION,
        environment: "UNKNOWN",
        source: "SYSTEM",
        payload: {},
        metadata: {
          schemaVersion: CORE_EVENT_SCHEMA_VERSION,
          createdBy: "SYSTEM",
          safeToReplay: true,
        },
      },
      warnings: [warn("INVALID_INPUT", "Event must be a JSON object.", "event")],
    };
  }

  const raw = rawEvent;
  const rawPayload = isRecord(raw.payload) ? { ...raw.payload } : {};
  if (!isRecord(raw.payload)) {
    warnings.push(warn("PAYLOAD_INFERRED", "payload was missing or not an object; using {}.", "payload"));
  }

  const runId = readString(raw, "runId");
  const metadata = buildMetadata(raw, rawPayload, runId, warnings);
  const environment = inferEnvironment(raw);

  if (environment === "UNKNOWN" && !readString(raw, "environment")) {
    warnings.push(
      warn("ENVIRONMENT_UNKNOWN", "Could not determine environment; set to UNKNOWN.", "environment"),
    );
  }

  const source = inferSource(
    raw,
    isRecord(rawPayload[CORE_META_PAYLOAD_KEY])
      ? (rawPayload[CORE_META_PAYLOAD_KEY] as Record<string, unknown>)
      : undefined,
  );

  const event: CoreEvent = {
    eventId: readString(raw, "eventId") ?? "",
    type: readString(raw, "type") ?? "",
    timestamp: readString(raw, "timestamp") ?? "",
    version: readString(raw, "version") ?? CORE_EVENT_VERSION,
    environment,
    runId,
    decisionLogId: readString(raw, "decisionLogId"),
    previewId: readString(raw, "previewId"),
    tradeId: readString(raw, "tradeId"),
    positionId: readString(raw, "positionId"),
    closePreviewId: readString(raw, "closePreviewId"),
    strategyVersion: readString(raw, "strategyVersion"),
    source,
    payload: stripCoreMetaFromPayload(rawPayload),
    metadata,
  };

  return { event, warnings };
}

/** Convert CoreEvent back to journal append shape (adapter for legacy store). */
export function coreEventToJournalInput(
  event: CoreEvent,
): Omit<JournalEvent, "eventId" | "timestamp"> & { eventId?: string; timestamp?: string } {
  return {
    type: event.type as JournalEvent["type"],
    environment: event.environment === "PAPER" ? "simulation" : "testnet",
    runId: event.runId,
    decisionLogId: event.decisionLogId,
    previewId: event.previewId,
    tradeId: event.tradeId,
    positionId: event.positionId,
    closePreviewId: event.closePreviewId,
    payload: {
      ...event.payload,
      [CORE_META_PAYLOAD_KEY]: {
        ...event.metadata,
        source: event.source,
        strategyVersion: event.strategyVersion,
      },
    },
  };
}

export function collectNormalizationCorrelationWarnings(event: CoreEvent): EventValidationIssue[] {
  const warnings: EventValidationIssue[] = [];
  const { type } = event;

  const needsRunId = ["ANALYSIS_STARTED", "VERDICT_CREATED", "MISSION_SNAPSHOT_UPDATED"].includes(type);
  if (needsRunId && !event.runId) {
    warnings.push(warn("MISSING_RUN_ID", `Analysis event ${type} should include runId.`, "runId"));
  }

  const needsDecisionLogId = [
    "VERDICT_CREATED",
    "PREVIEW_CREATED",
    "EXECUTION_REVIEWED",
    "ORDER_EXECUTED",
  ].includes(type);
  if (needsDecisionLogId && !event.decisionLogId) {
    warnings.push(
      warn("MISSING_DECISION_LOG_ID", `Decision event ${type} should include decisionLogId.`, "decisionLogId"),
    );
  }

  return warnings;
}
