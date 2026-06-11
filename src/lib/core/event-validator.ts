import type { AppendEventInput, JournalEvent } from "@/lib/journal/journal-types";
import { validateJournalChain } from "@/lib/journal/journal-chain-validator";
import type { CoreValidationIssue, EventValidationIssue, EventValidationResult } from "./core-errors";
import { isBlockingIssue, toCoreValidationIssues } from "./core-errors";
import {
  deriveTradeLifecycleState,
  validateLifecycleForCoreEvent,
  validateLifecycleTransition,
  deriveLifecycleState,
} from "./lifecycle-state-machine";
import {
  attachCoreMetadata,
  type CoreAppendInput,
  type CoreEvent,
  ANALYSIS_EVENT_TYPES,
  EXECUTION_EVENT_TYPES,
  LIVE_ORDER_EVENT_TYPES,
  MIROFISH_EVENT_TYPES,
  MIROFISH_FORBIDDEN_PAYLOAD_KEYS,
  TRADE_LIFECYCLE_EVENT_TYPES,
} from "./event-types";
import { collectNormalizationCorrelationWarnings, normalizeToCoreEvent } from "./event-normalizer";
import { validateSecretLeakage } from "./secret-leakage-validator";

export interface EventValidationOptions {
  checkLifecycle?: boolean;
  checkDuplicates?: boolean;
  checkSecrets?: boolean;
  checkLiveLeak?: boolean;
  checkCorrelation?: boolean;
  existingEvents?: JournalEvent[];
}

/** @deprecated Use EventValidationResult with errors/warnings split. */
export interface LegacyEventValidationResult {
  valid: boolean;
  issues: CoreValidationIssue[];
  normalized?: AppendEventInput;
}

function error(
  code: string,
  message: string,
  field?: string,
  requiredAction?: string,
): EventValidationIssue {
  return { code, message, severity: "ERROR", field, requiredAction };
}

function warning(code: string, message: string, field?: string): EventValidationIssue {
  return { code, message, severity: "WARNING", field };
}

function isValidIsoTimestamp(value: string): boolean {
  if (!value.trim()) return false;
  const ms = Date.parse(value);
  return !Number.isNaN(ms);
}

const TRADE_SCOPED_TYPES = new Set<string>([
  ...TRADE_LIFECYCLE_EVENT_TYPES,
  "EXECUTE_BLOCKED",
  "CLOSE_BLOCKED",
  "PNL_CALCULATION_STARTED",
  "LEARNING_STARTED",
  "TRADE_REFLECTION_COMPLETED",
  "EVIDENCE_TRADE_REJECTED",
]);

const EXECUTION_PREVIEW_TYPES = new Set<string>([
  "EXECUTION_REVIEWED",
  "EXECUTE_BLOCKED",
  "DOUBLE_CONFIRM_REQUIRED",
  "ORDER_EXECUTED",
  "POSITION_OPENED",
]);

const CLOSE_PREVIEW_TYPES = new Set<string>([
  "CLOSE_PREVIEW_CREATED",
  "CLOSE_PREVIEW_BLOCKED",
  "CLOSE_REVIEWED",
  "CLOSE_BLOCKED",
  "CLOSE_ORDER_EXECUTED",
]);

const DECISION_TYPES = new Set<string>([
  "VERDICT_CREATED",
  "PREVIEW_CREATED",
  "PREVIEW_BLOCKED",
  "PREVIEW_EXPIRED",
]);

export function validateCoreEvent(
  event: CoreEvent,
  options: Pick<
    EventValidationOptions,
    "checkSecrets" | "checkLiveLeak" | "checkCorrelation" | "checkLifecycle" | "existingEvents"
  > = {},
): EventValidationResult {
  const errors: EventValidationIssue[] = [];
  const warnings: EventValidationIssue[] = [];

  if (!event.eventId?.trim()) {
    errors.push(error("MISSING_EVENT_ID", "eventId is required.", "eventId"));
  }
  if (!event.type?.trim()) {
    errors.push(error("MISSING_TYPE", "type is required.", "type"));
  }
  if (!event.timestamp?.trim()) {
    errors.push(error("MISSING_TIMESTAMP", "timestamp is required.", "timestamp"));
  } else if (!isValidIsoTimestamp(event.timestamp)) {
    errors.push(error("INVALID_TIMESTAMP", "timestamp must be a valid ISO 8601 string.", "timestamp"));
  }
  if (!event.version?.trim()) {
    errors.push(error("MISSING_VERSION", "version is required.", "version"));
  }
  if (!event.environment) {
    errors.push(error("MISSING_ENVIRONMENT", "environment is required.", "environment"));
  }
  if (!event.source) {
    errors.push(error("MISSING_SOURCE", "source is required.", "source"));
  }
  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
    errors.push(error("INVALID_PAYLOAD", "payload must be a plain object.", "payload"));
  }

  if (!event.metadata) {
    errors.push(error("MISSING_METADATA", "metadata is required.", "metadata"));
  } else {
    if (!event.metadata.schemaVersion?.trim()) {
      errors.push(
        error("MISSING_SCHEMA_VERSION", "metadata.schemaVersion is required.", "metadata.schemaVersion"),
      );
    }
    if (!event.metadata.createdBy) {
      errors.push(error("MISSING_CREATED_BY", "metadata.createdBy is required.", "metadata.createdBy"));
    }
    if (typeof event.metadata.safeToReplay !== "boolean") {
      errors.push(
        error(
          "MISSING_SAFE_TO_REPLAY",
          "metadata.safeToReplay must be a boolean.",
          "metadata.safeToReplay",
        ),
      );
    }
  }

  if (options.checkCorrelation !== false) {
    if (TRADE_SCOPED_TYPES.has(event.type) && !event.tradeId) {
      warnings.push(
        warning("MISSING_TRADE_ID", `Trade lifecycle event ${event.type} should include tradeId.`, "tradeId"),
      );
    }
    if (ANALYSIS_EVENT_TYPES.includes(event.type) && !event.runId) {
      warnings.push(
        warning("MISSING_RUN_ID", `Analysis event ${event.type} should include runId.`, "runId"),
      );
    }
    if (
      (DECISION_TYPES.has(event.type) || EXECUTION_EVENT_TYPES.includes(event.type)) &&
      !event.decisionLogId &&
      event.type !== "ORDER_EXECUTED"
    ) {
      warnings.push(
        warning(
          "MISSING_DECISION_LOG_ID",
          `Decision event ${event.type} should include decisionLogId.`,
          "decisionLogId",
        ),
      );
    }
    if (EXECUTION_PREVIEW_TYPES.has(event.type) && !event.previewId && event.type !== "EXECUTION_REVIEWED") {
      warnings.push(
        warning(
          "MISSING_PREVIEW_ID",
          `Execution event ${event.type} should include previewId.`,
          "previewId",
        ),
      );
    }
    if (CLOSE_PREVIEW_TYPES.has(event.type) && !event.closePreviewId && event.type.includes("CLOSE")) {
      if (
        ["CLOSE_PREVIEW_CREATED", "CLOSE_PREVIEW_BLOCKED", "CLOSE_REVIEWED", "CLOSE_BLOCKED"].includes(
          event.type,
        )
      ) {
        warnings.push(
          warning(
            "MISSING_CLOSE_PREVIEW_ID",
            `Close event ${event.type} should include closePreviewId.`,
            "closePreviewId",
          ),
        );
      }
    }
  }

  if (options.checkSecrets !== false && event.payload) {
    const leakage = validateSecretLeakage(
      event.payload,
      event.metadata as unknown as Record<string, unknown>,
    );
    for (const issue of leakage.issues) {
      errors.push(issue);
    }
  }

  if (options.checkLiveLeak !== false) {
    validateLiveOrderPolicy(event, errors, warnings);
  }

  if (MIROFISH_EVENT_TYPES.includes(event.type) && event.payload) {
    for (const key of MIROFISH_FORBIDDEN_PAYLOAD_KEYS) {
      if (key in event.payload) {
        errors.push(
          error(
            "MIROFISH_EXECUTION_PAYLOAD",
            `MiroFish advisory event must not contain execution field "${key}".`,
            `payload.${key}`,
            "Keep MiroFish events advisory-only.",
          ),
        );
      }
    }
  }

  if (options.checkLifecycle !== false && event.tradeId && options.existingEvents) {
    const lifeIssues = validateLifecycleForCoreEvent(event, options.existingEvents, { mode: "strict" });
    for (const li of lifeIssues) {
      errors.push(
        error(
          li.code,
          li.message,
          "tradeId",
          "Resolve lifecycle prerequisites (V-008–V-011) before strict append.",
        ),
      );
    }
  }

  return {
    valid: errors.filter(isBlockingIssue).length === 0,
    errors,
    warnings,
  };
}

function validateLiveOrderPolicy(
  event: CoreEvent,
  errors: EventValidationIssue[],
  warnings: EventValidationIssue[],
): void {
  if (LIVE_ORDER_EVENT_TYPES.includes(event.type)) {
    if (event.environment !== "TESTNET" && event.environment !== "PAPER") {
      errors.push(
        error(
          "LIVE_TRADING_EVENT",
          "Order-like events may only be recorded under TESTNET or PAPER environment.",
          "environment",
          "Live trading remains policy-locked.",
        ),
      );
    }
  }

  if (event.type === "LIVE_DRY_RUN_CREATED" || event.type === "LIVE_PREFLIGHT_CHECKED") {
    warnings.push(
      warning(
        "LIVE_SANDBOX_EVENT",
        "Live sandbox event recorded; execution remains policy-locked.",
        "type",
      ),
    );
  }
}

export function validateRawCoreEvent(
  rawEvent: unknown,
  options: Pick<
    EventValidationOptions,
    "checkSecrets" | "checkLiveLeak" | "checkCorrelation" | "checkLifecycle" | "existingEvents"
  > = {},
): EventValidationResult & { normalizedEvent: CoreEvent | null; lifecycleState?: string; invalidTransitions?: unknown[] } {
  const { event, warnings: normWarnings } = normalizeToCoreEvent(rawEvent);
  const correlationWarnings = collectNormalizationCorrelationWarnings(event);
  const result = validateCoreEvent(event, options);
  const allWarnings = [...normWarnings, ...correlationWarnings, ...result.warnings];

  let lifecycleState: string | undefined;
  let invalidTransitions: unknown[] | undefined;
  if (event.tradeId && options.existingEvents && options.checkLifecycle !== false) {
    const simulated = [
      ...options.existingEvents,
      {
        eventId: event.eventId || "sim",
        timestamp: event.timestamp || new Date().toISOString(),
        type: event.type,
        environment: event.environment === "PAPER" ? "simulation" : "testnet",
        tradeId: event.tradeId,
        previewId: event.previewId,
        closePreviewId: event.closePreviewId,
        decisionLogId: event.decisionLogId,
        runId: event.runId,
        payload: event.payload,
      } as JournalEvent,
    ];
    const snap = deriveLifecycleState(event.tradeId, simulated);
    lifecycleState = snap.state;
    invalidTransitions = snap.invalidTransitions;
  }

  return {
    valid: result.valid,
    errors: result.errors,
    warnings: allWarnings,
    normalizedEvent: event,
    lifecycleState,
    invalidTransitions,
  };
}

export function validateEventEnvelope(
  input: AppendEventInput | CoreAppendInput,
  options: EventValidationOptions = {},
): LegacyEventValidationResult {
  const { event, warnings: normWarnings } = normalizeToCoreEvent({
    ...input,
    eventId: "eventId" in input ? input.eventId : "draft",
    timestamp: input.timestamp ?? new Date().toISOString(),
    version: "version" in input ? (input as CoreAppendInput).version : "1.0",
    source: "source" in input ? (input as CoreAppendInput).source : "SYSTEM",
    metadata:
      "metadata" in input && input.metadata
        ? {
            schemaVersion: String(input.metadata.schemaVersion ?? "core-event-v1"),
            createdBy: input.metadata.createdBy ?? "SYSTEM",
            safeToReplay: input.metadata.safeToReplay ?? true,
            correlationId: input.metadata.correlationId,
            causationId: input.metadata.causationId,
          }
        : undefined,
  });

  const coreResult = validateCoreEvent(event, {
    checkSecrets: options.checkSecrets,
    checkLiveLeak: options.checkLiveLeak,
    checkCorrelation: options.checkCorrelation ?? false,
  });

  if (!input.environment) {
    coreResult.errors.push(error("MISSING_ENVIRONMENT", "Environment is required.", "environment"));
  } else if ((input.environment as string) === "live") {
    coreResult.errors.push(error("LIVE_ENVIRONMENT", "Live environment events are not allowed.", "environment"));
  }

  const allIssues = [...normWarnings, ...coreResult.errors, ...coreResult.warnings];

  if (options.checkDuplicates && options.existingEvents && input.type) {
    const dup = options.existingEvents.find(
      (e) =>
        e.type === input.type &&
        e.tradeId === input.tradeId &&
        e.previewId === input.previewId &&
        e.timestamp === (input.timestamp ?? e.timestamp),
    );
    if (dup) {
      allIssues.push(warning("DUPLICATE_EVENT", `Duplicate ${input.type} detected.`));
    }
  }

  const normalized =
    "metadata" in input && input.metadata
      ? attachCoreMetadata(input as CoreAppendInput)
      : (input as AppendEventInput);

  const issues = toCoreValidationIssues(allIssues);
  const errors = allIssues.filter(isBlockingIssue);
  return { valid: errors.length === 0, issues, normalized };
}

export function validateEventBatch(
  events: JournalEvent[],
  options: Pick<EventValidationOptions, "checkLifecycle"> = {},
): CoreValidationIssue[] {
  const issues: CoreValidationIssue[] = [];

  for (const chain of validateJournalChain(events)) {
    issues.push({
      code: chain.code,
      message: chain.message,
      severity: chain.severity === "BLOCK" ? "ERROR" : "WARNING",
    });
  }

  if (options.checkLifecycle !== false) {
    const tradeIds = [
      ...new Set(events.filter((e) => e.tradeId).map((e) => e.tradeId as string)),
    ];
    for (const tradeId of tradeIds) {
      const snapshot = deriveTradeLifecycleState(tradeId, events);
      for (const life of snapshot.issues) {
        // Read-mode journal scan: lifecycle BLOCK issues are warnings, not execution blockers.
        issues.push({
          code: life.code,
          message: life.message,
          severity: "WARNING",
          tradeId,
        });
      }
    }
  }

  return issues;
}

export function validateBeforeAppend(
  input: CoreAppendInput,
  existingEvents: JournalEvent[],
  options: EventValidationOptions = {},
): LegacyEventValidationResult {
  const envelope = validateEventEnvelope(input, {
    ...options,
    existingEvents,
    checkDuplicates: options.checkDuplicates ?? true,
  });
  if (!envelope.valid) return envelope;

  if (options.checkLifecycle !== false && input.tradeId) {
    const lifeIssues = validateLifecycleTransition(
      {
        type: input.type,
        tradeId: input.tradeId,
        previewId: input.previewId,
        closePreviewId: input.closePreviewId,
        decisionLogId: input.decisionLogId,
        runId: input.runId,
        timestamp: input.timestamp ?? new Date().toISOString(),
      },
      existingEvents,
      { mode: "strict" },
    );
    for (const li of lifeIssues) {
      envelope.issues.push({
        code: li.code,
        message: li.message,
        severity: li.severity === "BLOCK" ? "ERROR" : "WARNING",
      });
    }
  }

  const errors = envelope.issues.filter((i) => i.severity === "ERROR");
  return { ...envelope, valid: errors.length === 0 };
}

export type { EventValidationResult };
