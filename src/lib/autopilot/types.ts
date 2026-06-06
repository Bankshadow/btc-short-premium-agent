import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { CommandCenterStatus } from "@/lib/command-center/types";
import type { OperatorAction } from "@/lib/operator-action-queue/types";

export type AutopilotRunStatus =
  | "IDLE"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED";

export type AutopilotMode =
  | "OFF"
  | "ANALYSIS_ONLY"
  | "PAPER_AUTOPILOT"
  | "SHADOW_AUTOPILOT"
  | "LIVE_LOCKED";

export type AutopilotModuleId =
  | "analyze"
  | "portfolio"
  | "validation"
  | "strategy_registry"
  | "learning"
  | "action_queue"
  | "alert_check"
  | "sync_check"
  | "command_center";

export interface AutopilotModuleResult {
  moduleId: AutopilotModuleId;
  status: "OK" | "SKIPPED" | "ERROR" | "BLOCKED";
  summary: string;
  details?: string;
  error?: string;
  shouldDisplayToUser: boolean;
  durationMs: number;
}

export interface LearningStatus {
  decisionLogsCount: number;
  resolvedOutcomesCount: number;
  paperTradesCount: number;
  shadowTradesCount: number;
  strategySampleSize: number;
  minRequiredSampleSize: number;
  agentScoreboardReady: boolean;
  validationReady: boolean;
  capitalScalingReady: boolean;
  label: string;
  detail: string;
}

export interface PortfolioSnapshotBrief {
  paperPnlPct: number;
  openPaperTrades: number;
  sampleSize: number;
  drawdownPct: number;
  exposureUsd: number;
}

export interface AutopilotSettings {
  autopilotEnabled: boolean;
  paperAutopilotEnabled: boolean;
  shadowModeEnabled: boolean;
  autoResolveEnabled: boolean;
  liveAutopilotEnabled: false;
  requireHumanApprovalForLive: true;
  mode: AutopilotMode;
  runIntervalMinutes: number;
  maxPaperTradesPerDay: number;
  maxShadowTradesPerDay: number;
  lastRunAt: string | null;
  lastRunId: string | null;
  nextRunAt: string | null;
}

export interface AutopilotRunResult {
  runId: string;
  startedAt: string;
  completedAt: string | null;
  status: AutopilotRunStatus;
  mode: AutopilotMode;
  deskStatus: CommandCenterStatus;
  finalVerdict: "TRADE" | "WAIT" | "SKIP" | "NONE";
  confidence: number;
  recommendedAction: string;
  blockers: string[];
  actionsCreated: OperatorAction[];
  modulesRun: AutopilotModuleResult[];
  modulesSkipped: AutopilotModuleId[];
  portfolioSnapshot: PortfolioSnapshotBrief;
  learningStatus: LearningStatus;
  briefing: string;
  analyze: AnalyzeApiResponse | null;
  nextRunAt: string | null;
  errors: string[];
  cannotEnableLiveAutopilot: true;
  safetyNotice: string;
}

export interface AutopilotRunInput {
  entries?: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  orders?: import("@/lib/paper/paper-order-types").PaperOrder[];
  perpPositions?: import("@/lib/multi-asset/types").PerpPaperPosition[];
  riskProfile?: import("@/lib/desk/desk-risk-policy").DeskRiskProfile;
  latestAnalysis?: AnalyzeApiResponse | null;
  settings?: AutopilotSettings;
  serverContext?: import("@/lib/live-readiness/types").ServerReadinessContext;
  skipAnalyze?: boolean;
}
