import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { OperatorAction } from "@/lib/operator-action-queue/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AutopilotRunResult } from "@/lib/autopilot/types";

export type AutomationJobType =
  | "MARKET_SNAPSHOT"
  | "DESK_ANALYZE"
  | "PAPER_MONITOR"
  | "PORTFOLIO_SNAPSHOT"
  | "LEARNING_UPDATE"
  | "RISK_CHECK"
  | "NOTIFICATION_DIGEST"
  | "ACTION_QUEUE_REFRESH"
  | "COMMAND_CENTER_REFRESH"
  | "PROJECT_STRATEGIST_REVIEW"
  | "BINANCE_TESTNET_MONITOR"
  | "BINANCE_TESTNET_AUTOEXECUTE"
  | "SELF_LEARNING_UPDATE"
  | "SECOND_BRAIN_CONSOLIDATE"
  | "PARALLEL_AGENT_REVIEW"
  | "DAILY_SELF_REVIEW"
  | "CONFIDENCE_CALIBRATION_UPDATE"
  | "TRADE_QUALITY_SCORE_UPDATE"
  | "TRADE_BLACK_BOX_CAPTURE"
  | "CONTINUOUS_IMPROVEMENT_DETECT";

export type AutomationJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "SKIPPED"
  | "BLOCKED";

export type AutomationRunStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "SKIPPED"
  | "BLOCKED";

export interface AutomationJob {
  jobId: string;
  workspaceId: string;
  jobType: AutomationJobType;
  status: AutomationJobStatus;
  idempotencyKey: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  resultSummary: string;
  error: string | null;
  linkedRunId: string;
}

export interface AutomationRun {
  runId: string;
  workspaceId: string;
  status: AutomationRunStatus;
  trigger: "manual" | "interval" | "cron" | "retry" | "client" | "bootstrap";
  idempotencyKey: string;
  startedAt: string;
  completedAt: string | null;
  jobs: AutomationJob[];
  errors: string[];
  nextRunAt: string | null;
  linkedRunId: string | null;
  safetyNotice: string;
  cannotApproveLiveTrades: true;
  cannotIncreaseRisk: true;
  cannotDisableKillSwitch: true;
  analyze: AnalyzeApiResponse | null;
  autopilotResult: AutopilotRunResult | null;
}

export interface AutomationModuleToggles {
  MARKET_SNAPSHOT: boolean;
  DESK_ANALYZE: boolean;
  PAPER_MONITOR: boolean;
  PORTFOLIO_SNAPSHOT: boolean;
  LEARNING_UPDATE: boolean;
  RISK_CHECK: boolean;
  NOTIFICATION_DIGEST: boolean;
  ACTION_QUEUE_REFRESH: boolean;
  COMMAND_CENTER_REFRESH: boolean;
  PROJECT_STRATEGIST_REVIEW: boolean;
  BINANCE_TESTNET_MONITOR: boolean;
  BINANCE_TESTNET_AUTOEXECUTE: boolean;
  SELF_LEARNING_UPDATE: boolean;
  SECOND_BRAIN_CONSOLIDATE: boolean;
  PARALLEL_AGENT_REVIEW: boolean;
  DAILY_SELF_REVIEW: boolean;
  CONFIDENCE_CALIBRATION_UPDATE: boolean;
  TRADE_QUALITY_SCORE_UPDATE: boolean;
  TRADE_BLACK_BOX_CAPTURE: boolean;
  CONTINUOUS_IMPROVEMENT_DETECT: boolean;
}

export interface AutomationSettings {
  automationEnabled: boolean;
  paused: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  moduleToggles: AutomationModuleToggles;
}

export interface AutomationRunInput {
  workspaceId?: string;
  jobs?: AutomationJobType[];
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile?: DeskRiskProfile;
  force?: boolean;
  idempotencyKey?: string;
  trigger?: AutomationRun["trigger"];
  retryJobId?: string;
}

export interface AutomationFailedJob {
  failedJobId: string;
  runId: string;
  workspaceId: string;
  jobType: AutomationJobType;
  jobId: string;
  idempotencyKey: string;
  error: string;
  failedAt: string;
  retryCount: number;
  backoffUntil: string | null;
  input: AutomationRunInput;
}

export interface AutomationState {
  workspaceId: string;
  lock: {
    held: boolean;
    runId: string | null;
    acquiredAt: string | null;
    expiresAt: string | null;
  };
  jobLocks: Record<string, { runId: string; expiresAt: string }>;
  settings: AutomationSettings;
  lastRun: AutomationRun | null;
  lastSuccessfulRunAt: string | null;
  nextRunAt: string | null;
  consecutiveFailures: Partial<Record<AutomationJobType, number>>;
  recentIdempotencyKeys: string[];
}

export interface AutomationStatusSnapshot {
  state: AutomationState;
  activeJobs: AutomationJob[];
  failedJobs: AutomationFailedJob[];
  pendingOperatorActions: OperatorAction[];
}
