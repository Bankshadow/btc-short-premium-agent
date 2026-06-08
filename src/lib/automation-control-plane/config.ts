import type { AutomationJobType, AutomationModuleToggles, AutomationSettings } from "./types";
import {
  isTestnetPrimaryAutomation,
  resolveDefaultAutomationJobs,
  resolveTestnetPrimaryModuleToggles,
} from "./primary-mode";

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
  PROJECT_STRATEGIST_REVIEW: true,
  BINANCE_TESTNET_MONITOR: true,
  BINANCE_TESTNET_AUTOEXECUTE: true,
  SELF_LEARNING_UPDATE: true,
  SECOND_BRAIN_CONSOLIDATE: true,
  PARALLEL_AGENT_REVIEW: true,
  DAILY_SELF_REVIEW: true,
  CONFIDENCE_CALIBRATION_UPDATE: true,
  TRADE_QUALITY_SCORE_UPDATE: true,
  TRADE_BLACK_BOX_CAPTURE: true,
  CONTINUOUS_IMPROVEMENT_DETECT: true,
};

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  automationEnabled: true,
  paused: false,
  intervalMinutes: 15,
  lastRunAt: null,
  nextRunAt: null,
  moduleToggles: resolveEffectiveModuleToggles(),
};

export const DEFAULT_AUTOMATION_JOBS: AutomationJobType[] =
  resolveDefaultAutomationJobs();

export function resolveEffectiveModuleToggles(
  overrides?: Partial<AutomationModuleToggles>,
): AutomationModuleToggles {
  const base = { ...DEFAULT_MODULE_TOGGLES, ...overrides };
  return isTestnetPrimaryAutomation()
    ? resolveTestnetPrimaryModuleToggles(base)
    : base;
}

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
  PROJECT_STRATEGIST_REVIEW: "Project strategist review",
  BINANCE_TESTNET_MONITOR: "Binance testnet monitor & auto-close",
  BINANCE_TESTNET_AUTOEXECUTE: "Binance testnet auto-execute",
  SELF_LEARNING_UPDATE: "Self-learning evaluation",
  SECOND_BRAIN_CONSOLIDATE: "Second brain daily consolidate",
  PARALLEL_AGENT_REVIEW: "Parallel agent committee review",
  DAILY_SELF_REVIEW: "Daily AI self-review",
  CONFIDENCE_CALIBRATION_UPDATE: "Confidence calibration update",
  TRADE_QUALITY_SCORE_UPDATE: "Trade quality score update",
  TRADE_BLACK_BOX_CAPTURE: "Trade black box capture",
  CONTINUOUS_IMPROVEMENT_DETECT: "Continuous improvement detect",
};

/** Base backoff minutes by consecutive failure count (capped). */
export function backoffMinutesForFailures(count: number): number {
  if (count <= 0) return 0;
  return Math.min(60, 2 ** Math.min(count, 5));
}
