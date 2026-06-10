import { GOAL_MIN_TRADES_FOR_TRUST } from "@/lib/goal-engine/types";

/** MVP 94 — micro-live readiness review (report only; never enables live). */
export const MICRO_LIVE_READINESS_REVIEW_MVP = 94 as const;
export const MICRO_LIVE_READINESS_REVIEW_LABEL = "Micro-live Readiness Review";

export const READINESS_REVIEW_SAFETY_NOTICE =
  "Readiness review is advisory only. It cannot enable live trading or place live orders — operator human review required before any micro-live consideration.";

export type ReadinessReviewStatus = "READY_FOR_REVIEW" | "NOT_READY" | "BLOCKED";

export type ReadinessReviewCheckId =
  | "engine_consistency_ok"
  | "binance_testnet_stable"
  | "twelve_valid_trades"
  | "evidence_quality_passed"
  | "strategy_health_not_rejected"
  | "risk_budget_configured"
  | "kill_switch_working"
  | "reduce_only_close_tested"
  | "no_critical_incidents"
  | "daily_loss_limit_configured"
  | "double_confirm_enabled"
  | "audit_trail_complete"
  | "telegram_operator_ready";

export interface ReadinessReviewChecklistItem {
  id: ReadinessReviewCheckId;
  label: string;
  passed: boolean;
  hardBlock: boolean;
  detail: string | null;
}

export interface MicroLiveReadinessReviewSnapshot {
  mvp: typeof MICRO_LIVE_READINESS_REVIEW_MVP;
  label: typeof MICRO_LIVE_READINESS_REVIEW_LABEL;
  readinessStatus: ReadinessReviewStatus;
  readinessScore: number;
  checklist: ReadinessReviewChecklistItem[];
  blockers: string[];
  warnings: string[];
  nextActions: string[];
  topBlocker: string | null;
  cannotEnableLive: true;
  cannotPlaceLiveOrders: true;
  liveTradingLocked: true;
  safetyNotice: typeof READINESS_REVIEW_SAFETY_NOTICE;
  lastUpdatedAt: string;
}

export interface MicroLiveReadinessReviewBuildInput {
  connected: boolean;
  testnetConfigured: boolean;
  liveExecutionEnabled: boolean;
  liveBlocked: boolean;
  requireDoubleConfirm: boolean;
  killSwitchConfigured: boolean;
  killSwitchPaused: boolean;
  criticalIncidentOpen: boolean;
  criticalIncidentTitle: string | null;
  evidenceValidCount: number;
  evidenceMissingDecisionLogId: number;
  evidenceMissingCloseJournal: number;
  evidenceMissingPnl: number;
  evidenceQualityPassed: boolean;
  evidenceQualityBlockReason: string | null;
  strategyHealthStatus: string | null;
  strategyBlocksEntries: boolean;
  monitorHealthOk: boolean;
  monitorPositionUncertain: boolean;
  monitorCurrentIssue: string | null;
  engineConsistencyOk: boolean;
  engineConsistencyIssue: string | null;
  riskBudgetConfigured: boolean;
  dailyLossLimitConfigured: boolean;
  reduceOnlyCloseTested: boolean;
  auditTrailComplete: boolean;
  telegramOrOperatorReady: boolean;
  learningPendingCount: number;
}
