/** MVP 88 — engine consistency & reconciliation. */
export const ENGINE_CONSISTENCY_MVP = 88 as const;
export const ENGINE_CONSISTENCY_LABEL = "Engine Consistency & Reconciliation";

export type ConsistencyStatus = "OK" | "WARNING" | "BLOCKED";

export type ConsistencyIssueKind =
  | "trade_without_decision_log_id"
  | "closed_trade_without_pnl"
  | "pnl_not_on_dashboard"
  | "binance_position_not_in_journal"
  | "local_open_no_binance_position"
  | "decision_without_journal_event"
  | "learning_record_missing_after_closed"
  | "analysis_mission_decision_drift"
  | "central_state_decision_drift";

export type ConsistencyAutoFixId =
  | "journal_reconcile"
  | "journal_backfill"
  | "decision_log_backfill"
  | "monitor_event_backfill"
  | "learning_sync"
  | "mission_snapshot_refresh";

export interface ConsistencyIssue {
  id: string;
  kind: ConsistencyIssueKind;
  severity: "WARNING" | "BLOCKED";
  message: string;
  source: string;
  relatedId: string | null;
  autoFixId: ConsistencyAutoFixId | null;
  requiredManualAction: string | null;
}

export interface EngineConsistencySnapshot {
  mvp: typeof ENGINE_CONSISTENCY_MVP;
  label: typeof ENGINE_CONSISTENCY_LABEL;
  consistencyStatus: ConsistencyStatus;
  consistencyLabel: "Consistent" | "Warning" | "Blocked";
  positionStateUncertain: boolean;
  blocksNewTrades: boolean;
  issues: ConsistencyIssue[];
  autoFixAvailable: boolean;
  autoFixActions: ConsistencyAutoFixId[];
  requiredManualActions: string[];
  generatedAt: string;
  storeSummary: {
    decisionLogCount: number;
    tradeJournalCount: number;
    monitorEventCount: number;
    learningRecordCount: number;
    binanceOpenPositions: number;
    localOpenTrades: number;
    missionDecisionLogId: string | null;
    centralDecisionLogId: string | null;
    missionNetPnl: number;
    dashboardNetPnl: number;
  };
}

/** Compact link stored on AnalysisContext. */
export interface AnalysisContextConsistencyLink {
  status: ConsistencyStatus;
  positionStateUncertain: boolean;
  blocksNewTrades: boolean;
  issueCount: number;
  topIssue: string | null;
}

export interface CombinedEngineStatusSnapshot {
  mvp: 88;
  label: "Combined Engine Status";
  summary: ConsistencyStatus;
  summaryLabel: "Engine OK" | "Warning" | "Blocked";
  healthStatus: import("@/lib/analysis-engine-health/types").EngineHealthStatus;
  consistencyStatus: ConsistencyStatus;
  positionStateUncertain: boolean;
  blocksNewTrades: boolean;
  generatedAt: string;
}
