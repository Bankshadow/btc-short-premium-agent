import type { WorkerJobType, WorkerSettings } from "./types";

export const WORKER_STATE_FILE = "worker-state.json";
export const WORKER_HISTORY_FILE = "worker-history.json";
export const WORKER_FAILED_JOBS_FILE = "worker-failed-jobs.json";
export const WORKER_BACKBONE_FILE = "worker-backbone.json";

export const WORKER_SETTINGS_STORAGE_KEY = "btc-desk:worker-settings";
export const WORKER_LAST_RUN_STORAGE_KEY = "btc-desk:worker-last-run";

export const WORKER_LOCK_TTL_MS = 5 * 60_000;
export const WORKER_IDEMPOTENCY_WINDOW_MS = 10 * 60_000;
export const WORKER_MAX_HISTORY = 100;
export const WORKER_MAX_FAILED = 50;

export const WORKER_SAFETY_NOTICE =
  "Background worker cannot place live trades or approve proposals. Analysis, paper, shadow, learning, and notifications only.";

export const DEFAULT_WORKER_SETTINGS: WorkerSettings = {
  workerEnabled: true,
  intervalMinutes: 15,
  lastRunAt: null,
  nextRunAt: null,
};

export const DEFAULT_WORKER_JOBS: WorkerJobType[] = [
  "DATA_HEALTH_CHECK",
  "DESK_ANALYZE_CYCLE",
  "PORTFOLIO_SNAPSHOT",
  "LEARNING_UPDATE",
  "ACTION_QUEUE_UPDATE",
  "COMMAND_CENTER_CHECK",
  "PAPER_MONITOR",
  "NOTIFICATION_DIGEST",
];

export const WORKER_JOB_LABELS: Record<WorkerJobType, string> = {
  DESK_ANALYZE_CYCLE: "Desk analyze cycle",
  PAPER_MONITOR: "Paper monitor",
  PORTFOLIO_SNAPSHOT: "Portfolio snapshot",
  LEARNING_UPDATE: "Learning update",
  ACTION_QUEUE_UPDATE: "Action queue update",
  NOTIFICATION_DIGEST: "Notification digest",
  DATA_HEALTH_CHECK: "Data health check",
  COMMAND_CENTER_CHECK: "Command center check",
};
