import type { AutopilotRunResult } from "@/lib/autopilot/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { AutopilotSettings } from "@/lib/autopilot/types";
import type { DeskBackboneHealth } from "@/lib/data-backbone/types";

export type WorkerJobType =
  | "DESK_ANALYZE_CYCLE"
  | "PAPER_MONITOR"
  | "PORTFOLIO_SNAPSHOT"
  | "LEARNING_UPDATE"
  | "ACTION_QUEUE_UPDATE"
  | "NOTIFICATION_DIGEST"
  | "DATA_HEALTH_CHECK"
  | "COMMAND_CENTER_CHECK";

export type WorkerJobStatus = "OK" | "SKIPPED" | "ERROR" | "BLOCKED";

export type WorkerRunStatus =
  | "IDLE"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED"
  | "SKIPPED";

export interface WorkerSettings {
  workerEnabled: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface WorkerJobResult {
  jobType: WorkerJobType;
  status: WorkerJobStatus;
  durationMs: number;
  summary: string;
  error?: string;
  idempotencyKey: string;
}

export interface WorkerRunResult {
  runId: string;
  idempotencyKey: string;
  startedAt: string;
  completedAt: string | null;
  status: WorkerRunStatus;
  trigger: "manual" | "cron" | "client" | "retry";
  jobs: WorkerJobResult[];
  errors: string[];
  nextRunAt: string | null;
  backboneHealthy: boolean;
  backboneHealth: DeskBackboneHealth | null;
  autopilotResult: AutopilotRunResult | null;
  analyze: AnalyzeApiResponse | null;
  safetyNotice: string;
  cannotPlaceLiveTrades: true;
  cannotApproveProposals: true;
}

export interface WorkerRunInput {
  jobs?: WorkerJobType[];
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile?: DeskRiskProfile;
  settings?: Partial<AutopilotSettings>;
  workerSettings?: Partial<WorkerSettings>;
  force?: boolean;
  idempotencyKey?: string;
  trigger?: WorkerRunResult["trigger"];
  retryJobId?: string;
}

export interface WorkerFailedJob {
  failedJobId: string;
  runId: string;
  jobType: WorkerJobType;
  idempotencyKey: string;
  error: string;
  failedAt: string;
  retryCount: number;
  input: WorkerRunInput;
}

export interface WorkerState {
  lock: {
    held: boolean;
    runId: string | null;
    acquiredAt: string | null;
    expiresAt: string | null;
  };
  settings: WorkerSettings;
  lastRun: WorkerRunResult | null;
  lastSuccessfulRunAt: string | null;
  nextRunAt: string | null;
}
