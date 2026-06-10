import { GOAL_START_CAPITAL, GOAL_TARGET_CAPITAL } from "@/lib/goal-engine/types";
import type { IntegratedRiskBudgetSnapshot } from "@/lib/integrated-risk-budget/types";

/** MVP 92 — mission controller + risk budget unified. */
export const MISSION_CONTROLLER_RISK_BUDGET_MVP = 92 as const;
export const MISSION_CONTROLLER_RISK_BUDGET_LABEL =
  "Mission Controller & Risk Budget";

export type MissionMode =
  | "DEFENSIVE"
  | "NORMAL"
  | "OPPORTUNITY"
  | "COOLDOWN"
  | "PAUSED";

export interface MissionControllerRiskBudgetInputs {
  currentEquity: number;
  targetEquity: number;
  progressPct: number;
  winRate: number | null;
  losingStreak: number;
  maxDrawdownUsd: number;
  maxDrawdownPct: number;
  dailyPnlUsd: number;
  dailyPnlPct: number;
  openExposureUsd: number;
  openPositionCount: number;
  incidentOpenCount: number;
  criticalIncidentOpen: boolean;
  strategyHealthStatus: string | null;
  overconfidenceDetected: boolean;
  avgTradeQualityScore: number | null;
  evidenceCompletedTrades: number;
  evidenceRequired: number;
}

export interface MissionControllerRiskBudgetSnapshot {
  mvp: typeof MISSION_CONTROLLER_RISK_BUDGET_MVP;
  label: typeof MISSION_CONTROLLER_RISK_BUDGET_LABEL;
  missionMode: MissionMode;
  modeReason: string;
  nextAction: string;
  humanApprovalRequired: true;
  humanApprovalReason: string | null;
  recommendedRiskPerTrade: number;
  recommendedMaxNotional: number;
  recommendedDailyLossLimit: number;
  recommendedMaxOpenPositions: number;
  currentMaxNotional: number;
  currentDailyLossLimitPct: number;
  currentMaxOpenPositions: number;
  cannotIncreaseLiveRiskAutomatically: true;
  liveTradingLocked: true;
  autoApplyAllowed: false;
  reasons: string[];
  inputs: MissionControllerRiskBudgetInputs;
  /** MVP 78 integrated risk budget (underlying recommendation). */
  riskBudget: IntegratedRiskBudgetSnapshot;
  lastUpdatedAt: string;
}

export interface MissionControllerRiskBudgetBuildInput {
  integratedRiskBudget: IntegratedRiskBudgetSnapshot;
  currentEquity?: number;
  targetEquity?: number;
  winRate?: number | null;
  losingStreak?: number;
  maxDrawdownUsd?: number;
  dailyPnlUsd?: number;
  openExposureUsd?: number;
  openPositionCount?: number;
  incidentOpenCount?: number;
  criticalIncidentOpen?: boolean;
  automationPaused?: boolean;
  blocksNewTestnetEntries?: boolean;
}
