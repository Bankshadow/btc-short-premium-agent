export const AI_STATUS_SAFETY_NOTICE =
  "Live trading locked. Status card shows operator-friendly progress — raw logs in Advanced only.";

export type AiStatusEventType =
  | "ANALYSIS_STARTED"
  | "MARKET_FETCHED"
  | "AGENTS_REVIEWED"
  | "RISK_CHECKED"
  | "TRADE_CANDIDATE_CREATED"
  | "TESTNET_PREVIEW_CREATED"
  | "PERMISSION_REQUESTED"
  | "ORDER_EXECUTED"
  | "POSITION_MONITORED"
  | "TRADE_CLOSED"
  | "LEARNING_UPDATED";

export interface AiStatusEvent {
  id: string;
  type: AiStatusEventType;
  label: string;
  detail?: string;
  timestamp: string;
  runId?: string | null;
  linkedDecisionId?: string | null;
  linkedTradeId?: string | null;
  technical?: string;
}

export type AiStatusCommitteeRecommendation =
  | "CONTINUE"
  | "PAUSE_AND_REVIEW"
  | "IMPLEMENT_FOLLOW_UP";

export interface AiStatusCommitteeSummary {
  recommendation: AiStatusCommitteeRecommendation;
  summary: string;
  topReasons: string[];
  agentCount: number;
  actionItemCount: number;
  lastRunAt: string | null;
}

export interface AiStatusMemorySummary {
  headline: string;
  consciousHighlights: string[];
  topLessons: string[];
  lessonCount: number;
  subconsciousCount: number;
  lastConsolidatedAt: string | null;
}

export interface AiStatusLoopBlocker {
  active: boolean;
  reason: string | null;
  riskLevel: "PRODUCTIVE" | "SUSPICIOUS" | "STUCK" | null;
  actionDiversityPct: number | null;
  successRatePct: number | null;
  selfCheckSummary: string | null;
}

export interface AiStatusCardState {
  updatedAt: string;
  currentTask: string;
  currentStep: string;
  progressPct: number;
  permissionNeeded: boolean;
  permissionReason: string | null;
  estimatedNextAction: string;
  recentToolActions: AiStatusEvent[];
  isActive: boolean;
  runId: string | null;
  liveLocked: true;
  loopBlocker: AiStatusLoopBlocker;
  memorySummary: AiStatusMemorySummary | null;
  committeeSummary: AiStatusCommitteeSummary | null;
}

export interface EmitAiStatusInput {
  type: AiStatusEventType;
  label?: string;
  detail?: string;
  runId?: string | null;
  linkedDecisionId?: string | null;
  linkedTradeId?: string | null;
  technical?: string;
}
