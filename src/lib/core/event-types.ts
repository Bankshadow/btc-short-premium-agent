import type { AppendEventInput, JournalEvent, JournalEventType } from "@/lib/journal/journal-types";

/** Canonical core schema version string for normalized events. */
export const CORE_EVENT_SCHEMA_VERSION = "core-event-v1";
export const CORE_EVENT_VERSION = "1.0";

export type CoreEventEnvironment = "TESTNET" | "PAPER" | "LIVE_DISABLED" | "UNKNOWN";
export type CoreEventSource = "SYSTEM" | "USER" | "AGENT" | "EXCHANGE" | "OPERATOR";

export interface CoreEventMetadata {
  correlationId?: string;
  causationId?: string;
  schemaVersion: string;
  createdBy: CoreEventSource;
  safeToReplay: boolean;
}

export interface CoreEvent {
  eventId: string;
  type: string;
  timestamp: string;
  version: string;
  environment: CoreEventEnvironment;
  runId?: string;
  decisionLogId?: string;
  previewId?: string;
  tradeId?: string;
  positionId?: string;
  closePreviewId?: string;
  strategyVersion?: string;
  source: CoreEventSource;
  payload: Record<string, unknown>;
  metadata: CoreEventMetadata;
}

/** @deprecated Use CoreEventMetadata on normalized events; kept for payload __coreMeta compat. */
export type CoreEventCreatedBy = CoreEventSource;

/** Legacy metadata shape stored under payload.__coreMeta (schemaVersion may be number). */
export interface LegacyCorePayloadMeta {
  createdBy?: CoreEventSource;
  correlationId?: string;
  causationId?: string;
  schemaVersion?: number | string;
  safeToReplay?: boolean;
  source?: string;
  strategyVersion?: string;
}

export interface CoreAppendInput extends AppendEventInput {
  metadata?: LegacyCorePayloadMeta;
  version?: number | string;
  source?: CoreEventSource;
}

export interface ValidatedCoreEvent extends JournalEvent {
  version: number | string;
  metadata: LegacyCorePayloadMeta;
}

export const CORE_META_PAYLOAD_KEY = "__coreMeta";

// --- Event type constants (canonical core vocabulary) ---

export const CoreEventTypes = {
  // Analysis
  ANALYSIS_STARTED: "ANALYSIS_STARTED",
  VERDICT_CREATED: "VERDICT_CREATED",
  MISSION_SNAPSHOT_UPDATED: "MISSION_SNAPSHOT_UPDATED",
  // Preview
  PREVIEW_CREATED: "PREVIEW_CREATED",
  PREVIEW_BLOCKED: "PREVIEW_BLOCKED",
  PREVIEW_EXPIRED: "PREVIEW_EXPIRED",
  // Execution
  EXECUTION_REVIEWED: "EXECUTION_REVIEWED",
  EXECUTE_BLOCKED: "EXECUTE_BLOCKED",
  DOUBLE_CONFIRM_REQUIRED: "DOUBLE_CONFIRM_REQUIRED",
  ORDER_EXECUTED: "ORDER_EXECUTED",
  POSITION_OPENED: "POSITION_OPENED",
  // Position
  POSITION_MONITORED: "POSITION_MONITORED",
  POSITION_RECONCILIATION_WARNING: "POSITION_RECONCILIATION_WARNING",
  // Close
  CLOSE_PREVIEW_CREATED: "CLOSE_PREVIEW_CREATED",
  CLOSE_PREVIEW_BLOCKED: "CLOSE_PREVIEW_BLOCKED",
  CLOSE_REVIEWED: "CLOSE_REVIEWED",
  CLOSE_BLOCKED: "CLOSE_BLOCKED",
  CLOSE_ORDER_EXECUTED: "CLOSE_ORDER_EXECUTED",
  POSITION_CLOSED: "POSITION_CLOSED",
  // PnL
  PNL_CALCULATION_STARTED: "PNL_CALCULATION_STARTED",
  PNL_REALIZED: "PNL_REALIZED",
  TRADE_RESULT_CLASSIFIED: "TRADE_RESULT_CLASSIFIED",
  // Learning
  LEARNING_STARTED: "LEARNING_STARTED",
  LEARNING_RECORD_CREATED: "LEARNING_RECORD_CREATED",
  TRADE_REFLECTION_COMPLETED: "TRADE_REFLECTION_COMPLETED",
  // Evidence
  EVIDENCE_TRADE_VALIDATED: "EVIDENCE_TRADE_VALIDATED",
  EVIDENCE_TRADE_REJECTED: "EVIDENCE_TRADE_REJECTED",
  EVIDENCE_PROGRESS_UPDATED: "EVIDENCE_PROGRESS_UPDATED",
  // Core health
  ENGINE_HEALTH_CHECKED: "ENGINE_HEALTH_CHECKED",
  STATE_RECONCILIATION_WARNING: "STATE_RECONCILIATION_WARNING",
  ORPHAN_RECORD_DETECTED: "ORPHAN_RECORD_DETECTED",
  STATE_HEALTH_BLOCKED: "STATE_HEALTH_BLOCKED",
  // Strategy
  STRATEGY_TAGGED: "STRATEGY_TAGGED",
  STRATEGY_RESULT_UPDATED: "STRATEGY_RESULT_UPDATED",
  STRATEGY_HEALTH_UPDATED: "STRATEGY_HEALTH_UPDATED",
  // MiroFish
  MIROFISH_SWARM_STARTED: "MIROFISH_SWARM_STARTED",
  MIROFISH_AGENT_VOTED: "MIROFISH_AGENT_VOTED",
  MIROFISH_SCENARIO_REPORT_CREATED: "MIROFISH_SCENARIO_REPORT_CREATED",
  // Agent
  AGENT_SCORE_UPDATED: "AGENT_SCORE_UPDATED",
  AGENT_CONFIDENCE_ADJUSTED: "AGENT_CONFIDENCE_ADJUSTED",
  AGENT_OVERCONFIDENCE_DETECTED: "AGENT_OVERCONFIDENCE_DETECTED",
  // Regime
  REGIME_CLASSIFIED: "REGIME_CLASSIFIED",
  REGIME_MEMORY_RETRIEVED: "REGIME_MEMORY_RETRIEVED",
  // Rules
  RULE_ENGINE_EVALUATED: "RULE_ENGINE_EVALUATED",
  NO_TRADE_RULE_TRIGGERED: "NO_TRADE_RULE_TRIGGERED",
  TRADE_BLOCKED_BY_RULE: "TRADE_BLOCKED_BY_RULE",
  // Collaboration
  AGENT_PROPOSAL_CREATED: "AGENT_PROPOSAL_CREATED",
  AGENT_CRITIQUE_CREATED: "AGENT_CRITIQUE_CREATED",
  AGENT_CONSENSUS_CREATED: "AGENT_CONSENSUS_CREATED",
  // Improvement
  IMPROVEMENT_PROPOSAL_CREATED: "IMPROVEMENT_PROPOSAL_CREATED",
  IMPROVEMENT_APPROVED: "IMPROVEMENT_APPROVED",
  IMPROVEMENT_REJECTED: "IMPROVEMENT_REJECTED",
  // Versioning
  STRATEGY_VERSION_CREATED: "STRATEGY_VERSION_CREATED",
  STRATEGY_CHANGE_APPROVED: "STRATEGY_CHANGE_APPROVED",
  STRATEGY_ROLLBACK_EXECUTED: "STRATEGY_ROLLBACK_EXECUTED",
  // Operator
  OPERATOR_ACTION_RECORDED: "OPERATOR_ACTION_RECORDED",
  KILL_SWITCH_ENABLED: "KILL_SWITCH_ENABLED",
  KILL_SWITCH_DISABLED: "KILL_SWITCH_DISABLED",
  RISK_MODE_CHANGED: "RISK_MODE_CHANGED",
  MANUAL_NOTE_CREATED: "MANUAL_NOTE_CREATED",
  // Briefing / Replay
  DAILY_BRIEFING_CREATED: "DAILY_BRIEFING_CREATED",
  SESSION_REPLAY_CREATED: "SESSION_REPLAY_CREATED",
  // Portfolio Risk
  PORTFOLIO_RISK_EVALUATED: "PORTFOLIO_RISK_EVALUATED",
  DAILY_LOSS_LIMIT_TRIGGERED: "DAILY_LOSS_LIMIT_TRIGGERED",
  COOLDOWN_STARTED: "COOLDOWN_STARTED",
  PORTFOLIO_RISK_BLOCKED: "PORTFOLIO_RISK_BLOCKED",
  // Live Readiness
  MICRO_LIVE_READINESS_EVALUATED: "MICRO_LIVE_READINESS_EVALUATED",
  MICRO_LIVE_NOT_READY: "MICRO_LIVE_NOT_READY",
  MICRO_LIVE_READY_PENDING_APPROVAL: "MICRO_LIVE_READY_PENDING_APPROVAL",
  // Live Sandbox
  LIVE_PREFLIGHT_CHECKED: "LIVE_PREFLIGHT_CHECKED",
  LIVE_DRY_RUN_CREATED: "LIVE_DRY_RUN_CREATED",
  LIVE_BLOCKED_BY_POLICY: "LIVE_BLOCKED_BY_POLICY",
  // Audit
  AUDIT_PACK_CREATED: "AUDIT_PACK_CREATED",
  PRODUCTION_HEALTH_CHECKED: "PRODUCTION_HEALTH_CHECKED",
  SECURITY_CHECK_COMPLETED: "SECURITY_CHECK_COMPLETED",
  // Errors
  ERROR_RECORDED: "ERROR_RECORDED",
} as const;

export type CoreEventType = (typeof CoreEventTypes)[keyof typeof CoreEventTypes];

/** Journal-only types not in canonical CoreEventTypes map (backward compat). */
export const LEGACY_JOURNAL_EVENT_TYPES = [
  "LEARNING_CREATED",
  "DUPLICATE_ORDER_BLOCKED",
  "KILL_SWITCH_BLOCKED",
  "SCENARIO_CONTEXT_INJECTED",
  "ANALYSIS_WITH_SCENARIO_COMPLETED",
  "ENGINE_PAUSED",
  "ENGINE_RESUMED",
] as const satisfies readonly JournalEventType[];

export const ALL_KNOWN_EVENT_TYPES: readonly string[] = [
  ...Object.values(CoreEventTypes),
  ...LEGACY_JOURNAL_EVENT_TYPES,
];

export const ANALYSIS_EVENT_TYPES: readonly string[] = [
  CoreEventTypes.ANALYSIS_STARTED,
  CoreEventTypes.VERDICT_CREATED,
  CoreEventTypes.MISSION_SNAPSHOT_UPDATED,
  "SCENARIO_CONTEXT_INJECTED",
  "ANALYSIS_WITH_SCENARIO_COMPLETED",
];

export const DECISION_EVENT_TYPES: readonly string[] = [
  CoreEventTypes.VERDICT_CREATED,
  CoreEventTypes.PREVIEW_CREATED,
  CoreEventTypes.PREVIEW_BLOCKED,
  CoreEventTypes.PREVIEW_EXPIRED,
  CoreEventTypes.EXECUTION_REVIEWED,
  CoreEventTypes.EXECUTE_BLOCKED,
  CoreEventTypes.DOUBLE_CONFIRM_REQUIRED,
];

export const EXECUTION_EVENT_TYPES: readonly string[] = [
  CoreEventTypes.EXECUTION_REVIEWED,
  CoreEventTypes.EXECUTE_BLOCKED,
  CoreEventTypes.DOUBLE_CONFIRM_REQUIRED,
  CoreEventTypes.ORDER_EXECUTED,
  CoreEventTypes.POSITION_OPENED,
  "DUPLICATE_ORDER_BLOCKED",
  "KILL_SWITCH_BLOCKED",
];

export const CLOSE_EVENT_TYPES: readonly string[] = [
  CoreEventTypes.CLOSE_PREVIEW_CREATED,
  CoreEventTypes.CLOSE_PREVIEW_BLOCKED,
  CoreEventTypes.CLOSE_REVIEWED,
  CoreEventTypes.CLOSE_BLOCKED,
  CoreEventTypes.CLOSE_ORDER_EXECUTED,
  CoreEventTypes.POSITION_CLOSED,
];

export const TRADE_LIFECYCLE_EVENT_TYPES: JournalEventType[] = [
  "ANALYSIS_STARTED",
  "VERDICT_CREATED",
  "PREVIEW_CREATED",
  "EXECUTION_REVIEWED",
  "ORDER_EXECUTED",
  "POSITION_OPENED",
  "POSITION_MONITORED",
  "CLOSE_PREVIEW_CREATED",
  "CLOSE_REVIEWED",
  "CLOSE_ORDER_EXECUTED",
  "POSITION_CLOSED",
  "PNL_REALIZED",
  "TRADE_RESULT_CLASSIFIED",
  "LEARNING_RECORD_CREATED",
  "EVIDENCE_TRADE_VALIDATED",
];

export const MIROFISH_EVENT_TYPES: readonly string[] = [
  CoreEventTypes.MIROFISH_SWARM_STARTED,
  CoreEventTypes.MIROFISH_AGENT_VOTED,
  CoreEventTypes.MIROFISH_SCENARIO_REPORT_CREATED,
];

/** Events that must never carry exchange execution order payloads (MiroFish advisory-only). */
export const MIROFISH_FORBIDDEN_PAYLOAD_KEYS = [
  "orderId",
  "clientOrderId",
  "executedQty",
  "avgPrice",
  "reduceOnly",
] as const;

export const LIVE_ORDER_EVENT_TYPES: readonly string[] = [
  CoreEventTypes.ORDER_EXECUTED,
  CoreEventTypes.POSITION_OPENED,
  CoreEventTypes.CLOSE_ORDER_EXECUTED,
  CoreEventTypes.POSITION_CLOSED,
];

export function mapJournalEnvironmentToCore(
  env: string | undefined,
): CoreEventEnvironment {
  if (!env) return "UNKNOWN";
  const lower = env.toLowerCase();
  if (lower === "testnet") return "TESTNET";
  if (lower === "simulation") return "PAPER";
  if (lower === "live") return "LIVE_DISABLED";
  return "UNKNOWN";
}

export function mapCoreEnvironmentToJournal(
  env: CoreEventEnvironment,
): "testnet" | "simulation" {
  if (env === "PAPER") return "simulation";
  return "testnet";
}

export function attachCoreMetadata(
  input: CoreAppendInput,
): AppendEventInput & { payload: Record<string, unknown> } {
  const metadata: LegacyCorePayloadMeta = {
    schemaVersion: CORE_EVENT_SCHEMA_VERSION,
    safeToReplay: true,
    createdBy: input.source ?? input.metadata?.createdBy ?? "SYSTEM",
    correlationId: input.runId ?? input.metadata?.correlationId,
    ...input.metadata,
  };

  return {
    ...input,
    payload: {
      ...input.payload,
      [CORE_META_PAYLOAD_KEY]: metadata,
    },
  };
}

export function extractCoreMetadata(event: JournalEvent): LegacyCorePayloadMeta {
  const raw = event.payload[CORE_META_PAYLOAD_KEY];
  if (!raw || typeof raw !== "object") {
    return {
      schemaVersion: 0,
      safeToReplay: true,
      createdBy: "SYSTEM",
    };
  }
  return raw as LegacyCorePayloadMeta;
}
