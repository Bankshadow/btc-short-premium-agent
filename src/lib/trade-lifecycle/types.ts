export type TradeTimelineStage =
  | "AI_SIGNAL_CREATED"
  | "DECISION_LOGGED"
  | "ORDER_PREVIEW_CREATED"
  | "RISK_CHECK_PASSED"
  | "HUMAN_CONFIRMED"
  | "ORDER_EXECUTED"
  | "POSITION_OPENED"
  | "MONITORING_STARTED"
  | "CLOSE_RECOMMENDED"
  | "POSITION_CLOSED"
  | "PNL_REALIZED"
  | "REFLECTION_GENERATED"
  | "LEARNING_COMPLETED";

export type TradeTimelineActor = "AI" | "USER" | "SYSTEM" | "EXCHANGE";

export type TradeTimelineRiskStatus = "PASSED" | "BLOCKED" | "CAUTION" | "UNKNOWN";

export interface TradeTimelineLinkedIds {
  tradeId: string | null;
  decisionLogId: string | null;
  previewId: string | null;
  orderId: string | null;
  positionId: string | null;
  closedTradeId: string | null;
  learningRecordId: string | null;
}

export interface TradeTimelineEvent {
  eventId: string;
  stage: TradeTimelineStage;
  timestamp: string;
  actor: TradeTimelineActor;
  summary: string;
  payload: Record<string, unknown>;
  linkedIds: TradeTimelineLinkedIds;
  riskStatus: TradeTimelineRiskStatus;
  error: string | null;
}

export interface TradeLifecycleTimelineView {
  lookupId: string;
  tradeId: string;
  environment: string;
  symbol: string | null;
  strategy: string | null;
  linkedIds: TradeTimelineLinkedIds;
  events: TradeTimelineEvent[];
}
