/** MVP 85 — shared engine event bus for UI sync. */
export const ENGINE_EVENT_BUS_MVP = 85 as const;
export const ENGINE_EVENT_BUS_LABEL = "Engine Event Bus";

export type EngineEventType =
  | "ANALYSIS_STARTED"
  | "CONTEXT_BUILT"
  | "PLAYBOOK_COMPLETED"
  | "AGENTS_REVIEWED"
  | "RISK_CHECKED"
  | "GOVERNANCE_CHECKED"
  | "VERDICT_CREATED"
  | "TRADE_CANDIDATE_CREATED"
  | "PREVIEW_CREATED"
  | "PERMISSION_REQUESTED"
  | "ORDER_EXECUTED"
  | "POSITION_OPENED"
  | "POSITION_MONITORED"
  | "POSITION_CLOSED"
  | "PNL_REALIZED"
  | "LEARNING_CREATED"
  | "REPORT_UPDATED"
  | "READINESS_CHECKED"
  | "BLOCKER_CREATED"
  | "BLOCKER_RESOLVED";

export type EngineEventSeverity = "info" | "success" | "warning" | "critical";

export interface EngineEvent {
  id: string;
  mvp: typeof ENGINE_EVENT_BUS_MVP;
  type: EngineEventType;
  /** Operator-visible one-liner — never contains secrets. */
  summary: string;
  detail: string;
  timestamp: string;
  runId: string | null;
  decisionLogId: string | null;
  tradeId: string | null;
  previewId: string | null;
  symbol: string | null;
  severity: EngineEventSeverity;
  /** Shown in AI Status “last 5” strip and dashboard alerts. */
  meaningful: boolean;
  liveTradingLocked: true;
  payload: Record<string, string | number | boolean | null>;
}

export type EmitEngineEventInput = {
  type: EngineEventType;
  summary: string;
  detail?: string;
  runId?: string | null;
  decisionLogId?: string | null;
  tradeId?: string | null;
  previewId?: string | null;
  symbol?: string | null;
  severity?: EngineEventSeverity;
  meaningful?: boolean;
  payload?: Record<string, unknown>;
};

export const MEANINGFUL_ENGINE_EVENT_TYPES: ReadonlySet<EngineEventType> = new Set([
  "VERDICT_CREATED",
  "TRADE_CANDIDATE_CREATED",
  "PREVIEW_CREATED",
  "PERMISSION_REQUESTED",
  "ORDER_EXECUTED",
  "POSITION_OPENED",
  "POSITION_MONITORED",
  "POSITION_CLOSED",
  "PNL_REALIZED",
  "LEARNING_CREATED",
  "REPORT_UPDATED",
  "READINESS_CHECKED",
  "BLOCKER_CREATED",
  "BLOCKER_RESOLVED",
]);

export const DASHBOARD_ALERT_EVENT_TYPES: ReadonlySet<EngineEventType> = new Set([
  "VERDICT_CREATED",
  "PREVIEW_CREATED",
  "BLOCKER_CREATED",
  "BLOCKER_RESOLVED",
  "ORDER_EXECUTED",
  "POSITION_OPENED",
  "POSITION_CLOSED",
  "PNL_REALIZED",
  "PERMISSION_REQUESTED",
]);
