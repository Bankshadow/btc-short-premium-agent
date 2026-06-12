export type JournalEnvironment = "testnet" | "simulation";

export type JournalEventType =
  | "ANALYSIS_STARTED"
  | "VERDICT_CREATED"
  | "PREVIEW_CREATED"
  | "PREVIEW_BLOCKED"
  | "PREVIEW_EXPIRED"
  | "EXECUTION_REVIEWED"
  | "EXECUTE_BLOCKED"
  | "DOUBLE_CONFIRM_REQUIRED"
  | "DUPLICATE_ORDER_BLOCKED"
  | "KILL_SWITCH_BLOCKED"
  | "ORDER_EXECUTED"
  | "POSITION_OPENED"
  | "POSITION_MONITORED"
  | "POSITION_RECONCILIATION_WARNING"
  | "POSITION_CLOSED"
  | "CLOSE_PREVIEW_CREATED"
  | "CLOSE_PREVIEW_BLOCKED"
  | "CLOSE_REVIEWED"
  | "CLOSE_BLOCKED"
  | "CLOSE_ORDER_EXECUTED"
  | "PNL_CALCULATION_STARTED"
  | "PNL_PENDING_DATA"
  | "PNL_REALIZED"
  | "TRADE_RESULT_CLASSIFIED"
  | "LEARNING_STARTED"
  | "LEARNING_CREATED"
  | "LEARNING_RECORD_CREATED"
  | "TRADE_REFLECTION_COMPLETED"
  | "EVIDENCE_TRADE_VALIDATED"
  | "EVIDENCE_TRADE_REJECTED"
  | "EVIDENCE_VALIDATION_STARTED"
  | "EVIDENCE_PROGRESS_UPDATED"
  | "EVIDENCE_READINESS_UPDATED"
  | "ENGINE_HEALTH_CHECKED"
  | "STATE_RECONCILIATION_WARNING"
  | "ORPHAN_RECORD_DETECTED"
  | "STATE_HEALTH_BLOCKED"
  | "STRATEGY_TAGGED"
  | "STRATEGY_RESULT_UPDATED"
  | "STRATEGY_HEALTH_UPDATED"
  | "MIROFISH_SWARM_STARTED"
  | "MIROFISH_AGENT_VOTED"
  | "MIROFISH_SCENARIO_REPORT_CREATED"
  | "SCENARIO_CONTEXT_INJECTED"
  | "ANALYSIS_WITH_SCENARIO_COMPLETED"
  | "AGENT_SCORE_UPDATED"
  | "AGENT_CONFIDENCE_ADJUSTED"
  | "AGENT_OVERCONFIDENCE_DETECTED"
  | "REGIME_CLASSIFIED"
  | "REGIME_MEMORY_RETRIEVED"
  | "RULE_ENGINE_EVALUATED"
  | "NO_TRADE_RULE_TRIGGERED"
  | "TRADE_BLOCKED_BY_RULE"
  | "AGENT_PROPOSAL_CREATED"
  | "AGENT_CRITIQUE_CREATED"
  | "AGENT_CONSENSUS_CREATED"
  | "IMPROVEMENT_PROPOSAL_CREATED"
  | "IMPROVEMENT_APPROVED"
  | "IMPROVEMENT_REJECTED"
  | "STRATEGY_VERSION_CREATED"
  | "STRATEGY_CHANGE_APPROVED"
  | "STRATEGY_ROLLBACK_EXECUTED"
  | "OPERATOR_ACTION_RECORDED"
  | "KILL_SWITCH_ENABLED"
  | "KILL_SWITCH_DISABLED"
  | "RISK_MODE_CHANGED"
  | "MANUAL_NOTE_CREATED"
  | "ENGINE_PAUSED"
  | "ENGINE_RESUMED"
  | "DAILY_BRIEFING_CREATED"
  | "SESSION_REPLAY_CREATED"
  | "PORTFOLIO_RISK_EVALUATED"
  | "DAILY_LOSS_LIMIT_TRIGGERED"
  | "COOLDOWN_STARTED"
  | "PORTFOLIO_RISK_BLOCKED"
  | "MICRO_LIVE_READINESS_EVALUATED"
  | "MICRO_LIVE_NOT_READY"
  | "MICRO_LIVE_READY_PENDING_APPROVAL"
  | "LIVE_PREFLIGHT_CHECKED"
  | "LIVE_DRY_RUN_CREATED"
  | "LIVE_BLOCKED_BY_POLICY"
  | "AUDIT_PACK_CREATED"
  | "PRODUCTION_HEALTH_CHECKED"
  | "SECURITY_CHECK_COMPLETED"
  | "POLYMARKET_SCAN_STARTED"
  | "POLYMARKET_SIGNAL_CREATED"
  | "POLYMARKET_SIGNAL_BLOCKED"
  | "POLYMARKET_PAPER_TRADE_CREATED"
  | "POLYMARKET_RISK_EVENT"
  | "POLYMARKET_CYCLE_COMPLETED"
  | "SWEEPER_SCAN_STARTED"
  | "SWEEPER_OPPORTUNITY_DETECTED"
  | "SWEEPER_OPPORTUNITY_BLOCKED"
  | "SWEEPER_PAPER_TRADE_CREATED"
  | "SWEEPER_SCAN_COMPLETED"
  | "MISSION_SNAPSHOT_UPDATED"
  | "ERROR_RECORDED";

export interface JournalEvent {
  eventId: string;
  type: JournalEventType;
  timestamp: string;
  environment: JournalEnvironment;
  runId?: string;
  decisionLogId?: string;
  tradeId?: string;
  previewId?: string;
  positionId?: string;
  closePreviewId?: string;
  payload: Record<string, unknown>;
}

export type AppendEventInput = Omit<JournalEvent, "eventId" | "timestamp"> & {
  eventId?: string;
  timestamp?: string;
};

export function newEventId(prefix = "evt"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newRunId(): string {
  return newEventId("run");
}

export function newDecisionLogId(): string {
  return newEventId("dl");
}

export function newPositionId(): string {
  return newEventId("pos");
}

export function newClosePreviewId(): string {
  return newEventId("cprev");
}

export function newLearningId(): string {
  return newEventId("learn");
}

export function newSwarmReportId(): string {
  return newEventId("swarm");
}

export function newImprovementId(): string {
  return newEventId("imp");
}

export function newStrategyVersionId(): string {
  return newEventId("sv");
}

export function newCollaborationId(): string {
  return newEventId("collab");
}

export function newBriefingId(): string {
  return newEventId("brief");
}

export function newReplaySessionId(): string {
  return newEventId("replay");
}

export function newAuditPackId(): string {
  return newEventId("audit");
}
