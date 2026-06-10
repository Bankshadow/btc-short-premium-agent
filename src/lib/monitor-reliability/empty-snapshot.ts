import type { MonitorReliabilitySnapshot } from "./types";
import {
  MONITOR_RELIABILITY_LABEL,
  MONITOR_RELIABILITY_MVP,
} from "./types";

/** Client-safe default — no fs/cron imports. */
export function emptyMonitorReliabilitySnapshot(): MonitorReliabilitySnapshot {
  return {
    mvp: MONITOR_RELIABILITY_MVP,
    label: MONITOR_RELIABILITY_LABEL,
    health: "OK",
    currentIssue: null,
    recoveryAction: null,
    blocksNewEntries: false,
    positionStateUncertain: false,
    heartbeat: {
      lastMonitorRunAt: null,
      lastPositionRefreshAt: null,
      lastCloseCheckAt: null,
      lastJournalWriteAt: null,
      lastRecoveryAt: null,
      lastRunId: null,
      updatedAt: new Date().toISOString(),
    },
    issues: [],
    recoveredCount: 0,
    incidentsCreated: 0,
    lastUpdatedAt: new Date().toISOString(),
  };
}
