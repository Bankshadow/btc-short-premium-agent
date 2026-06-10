/** MVP 73B — monitor heartbeat, issue detection, and auto-recovery. */
export const MONITOR_RELIABILITY_MVP = 73 as const;
export const MONITOR_RELIABILITY_LABEL = "Monitor Reliability & Auto-Recovery";

/** Monitor considered stale after 2× default 15m automation interval. */
export const MONITOR_STALE_MS = 30 * 60 * 1000;

export type MonitorHealthStatus = "OK" | "WARNING" | "BLOCKED";

export type MonitorIssueKind =
  | "position_not_monitored"
  | "exchange_closed_not_journaled"
  | "closed_journal_missing_pnl"
  | "duplicate_close_attempt"
  | "stale_mark_price"
  | "monitor_not_running"
  | "expired_preview_executable"
  | "position_state_uncertain";

export interface MonitorHeartbeat {
  lastMonitorRunAt: string | null;
  lastPositionRefreshAt: string | null;
  lastCloseCheckAt: string | null;
  lastJournalWriteAt: string | null;
  lastRecoveryAt: string | null;
  lastRunId: string | null;
  updatedAt: string;
}

export interface MonitorIssue {
  kind: MonitorIssueKind;
  severity: "WARNING" | "CRITICAL";
  symbol: string | null;
  message: string;
  recovered: boolean;
}

export interface MonitorReliabilitySnapshot {
  mvp: typeof MONITOR_RELIABILITY_MVP;
  label: typeof MONITOR_RELIABILITY_LABEL;
  health: MonitorHealthStatus;
  currentIssue: string | null;
  recoveryAction: string | null;
  blocksNewEntries: boolean;
  positionStateUncertain: boolean;
  heartbeat: MonitorHeartbeat;
  issues: MonitorIssue[];
  recoveredCount: number;
  incidentsCreated: number;
  lastUpdatedAt: string;
}

export interface MonitorReliabilityBuildInput {
  journal: import("@/lib/exchange/binance/binance-types").BinanceTestnetJournalEntry[];
  positions: import("@/lib/exchange/binance/binance-types").BinancePosition[];
  connected: boolean;
  autoExecuteEnabled: boolean;
  runId?: string | null;
  /** When true, run auto-recovery before final issue list. */
  autoRecover?: boolean;
}
