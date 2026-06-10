import { GOAL_MIN_TRADES_FOR_TRUST } from "@/lib/goal-engine/types";

/** MVP 75 — micro-live readiness gate (assessment only; never enables live). */
export const MICRO_LIVE_READINESS_MVP = 75 as const;
export const MICRO_LIVE_READINESS_LABEL = "Micro-Live Readiness Gate";

export const MICRO_LIVE_EVIDENCE_REQUIRED = GOAL_MIN_TRADES_FOR_TRUST;

export type MicroLiveReadinessStatus =
  | "READY_FOR_REVIEW"
  | "NOT_READY"
  | "BLOCKED";

export interface ReadinessEvidenceLink {
  kind: "trade" | "decision" | "learning" | "journal" | "pnl";
  id: string;
  label: string;
}

export interface ReadinessChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  hardBlock: boolean;
  detail: string | null;
}

export interface ReadinessReport {
  readinessStatus: MicroLiveReadinessStatus;
  readinessScore: number;
  blockers: string[];
  warnings: string[];
  evidenceLinks: ReadinessEvidenceLink[];
  nextRequiredActions: string[];
  checklist: ReadinessChecklistItem[];
  missingConfigItems: string[];
  generatedAt: string;
}

export interface MicroLiveReadinessSnapshot {
  mvp: typeof MICRO_LIVE_READINESS_MVP;
  label: typeof MICRO_LIVE_READINESS_LABEL;
  readinessStatus: MicroLiveReadinessStatus;
  readinessScore: number;
  report: ReadinessReport;
  liveTradingLocked: true;
  liveExecutionEnabled: boolean;
  topBlocker: string | null;
  governanceWarningActive: boolean;
  lastUpdatedAt: string;
}

export interface MicroLiveReadinessBuildInput {
  connected: boolean;
  testnetConfigured: boolean;
  evidenceCompletedTrades: number;
  evidenceValidTrades: import("@/lib/evidence-progress/types").EvidenceProgressRow[];
  evidenceExcluded: import("@/lib/evidence-progress/types").EvidenceExcludedRow[];
  evidenceMissingDecisionLogId: number;
  evidenceMissingCloseJournal: number;
  evidenceMissingPnl: number;
  journal: import("@/lib/exchange/binance/binance-types").BinanceTestnetJournalEntry[];
  learningRecords: import("@/lib/testnet-monitor/types").TestnetLearningRecord[];
  learningPendingCount: number;
  monitorEvents: import("@/lib/testnet-monitor/types").TestnetMonitorJournalEvent[];
  requireDoubleConfirm: boolean;
  liveExecutionEnabled: boolean;
  liveBlocked: boolean;
  killSwitchConfigured: boolean;
  killSwitchPaused: boolean;
  criticalIncidentOpen: boolean;
  criticalIncidentTitle: string | null;
  riskBlockNewTrades: boolean;
  persistSideEffects?: boolean;
}
