import type { AutomationJobType, AutomationModuleToggles, AutomationSettings } from "./types";

export const AUTOMATION_STATE_FILE = "automation-control-state.json";
export const AUTOMATION_HISTORY_FILE = "automation-control-history.json";
export const AUTOMATION_FAILED_FILE = "automation-control-failed.json";
export const AUTOMATION_ACTIONS_FILE = "automation-pending-actions.json";
export const AUTOMATION_IDEMPOTENCY_FILE = "automation-idempotency.json";

export const AUTOMATION_LOCK_TTL_MS = 5 * 60_000;
export const AUTOMATION_IDEMPOTENCY_WINDOW_MS = 10 * 60_000;
export const AUTOMATION_MAX_HISTORY = 100;
export const AUTOMATION_MAX_FAILED = 50;
export const AUTOMATION_MAX_ACTIONS = 100;

export const AUTOMATION_SAFETY_NOTICE =
  "Automation cannot approve live trades, increase risk, or disable kill switch. Paper/shadow and risk-reducing actions only.";

export const DEFAULT_MODULE_TOGGLES: AutomationModuleToggles = {
  MARKET_SNAPSHOT: true,
  DESK_ANALYZE: true,
  PAPER_MONITOR: true,
  PORTFOLIO_SNAPSHOT: true,
  LEARNING_UPDATE: true,
  RISK_CHECK: true,
  NOTIFICATION_DIGEST: true,
  ACTION_QUEUE_REFRESH: true,
  COMMAND_CENTER_REFRESH: true,
};

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  automationEnabled: true,
  paused: false,
  intervalMinutes: 15,
  lastRunAt: null,
  nextRunAt: null,
  moduleToggles: { ...DEFAULT_MODULE_TOGGLES },
};

export const DEFAULT_AUTOMATION_JOBS: AutomationJobType[] = [
  "MARKET_SNAPSHOT",
  "DESK_ANALYZE",
  "PAPER_MONITOR",
  "PORTFOLIO_SNAPSHOT",
  "LEARNING_UPDATE",
  "RISK_CHECK",
  "ACTION_QUEUE_REFRESH",
  "COMMAND_CENTER_REFRESH",
  "NOTIFICATION_DIGEST",
];

export const AUTOMATION_JOB_LABELS: Record<AutomationJobType, string> = {
  MARKET_SNAPSHOT: "Market snapshot",
  DESK_ANALYZE: "Desk analyze",
  PAPER_MONITOR: "Paper monitor",
  PORTFOLIO_SNAPSHOT: "Portfolio snapshot",
  LEARNING_UPDATE: "Learning update",
  RISK_CHECK: "Risk check",
  NOTIFICATION_DIGEST: "Notification digest",
  ACTION_QUEUE_REFRESH: "Action queue refresh",
  COMMAND_CENTER_REFRESH: "Command center refresh",
};

/** Base backoff minutes by consecutive failure count (capped). */
export function backoffMinutesForFailures(count: number): number {
  if (count <= 0) return 0;
  return Math.min(60, 2 ** Math.min(count, 5));
}
