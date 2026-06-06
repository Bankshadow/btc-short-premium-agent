import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { RealTimeRiskStatus } from "@/lib/real-time-risk/types";

export const MISSION_CONTROLLER_SAFETY_NOTICE =
  "Mission controller is advisory — it may reduce risk automatically but cannot enable live trading or raise risk without operator approval.";

export type MissionControllerMode =
  | "DEFENSIVE"
  | "NORMAL"
  | "OPPORTUNITY"
  | "RECOVERY"
  | "PAUSED";

export type MissionRiskLevel = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";

export type MissionTradeFrequency = "PAUSED" | "LOW" | "NORMAL" | "ELEVATED";

export interface MissionControllerInputs {
  currentEquity: number;
  targetEquity: number;
  startEquity: number;
  dailyPnlPct: number;
  weeklyPnlPct: number;
  drawdownUsd: number;
  drawdownPct: number;
  winRate: number;
  losingStreak: number;
  openExposureUsd: number;
  aiConfidence: number;
  riskStatus: RealTimeRiskStatus;
  dailyLossLimitHit: boolean;
  completedTrades: number;
  trustReady: boolean;
  automationPaused: boolean;
  committeePause: boolean;
  loopGuardActive: boolean;
  pendingTestnetPreview: boolean;
  humanActionRequired: boolean;
}

export interface MissionControllerResult {
  generatedAt: string;
  mode: MissionControllerMode;
  modeReason: string;
  recommendedRiskLevel: MissionRiskLevel;
  riskLevelRequiresApproval: boolean;
  tradeFrequency: MissionTradeFrequency;
  allowedStrategyTypes: string[];
  nextAction: string;
  humanApprovalNeeded: boolean;
  humanApprovalReason: string | null;
  aiConfidence: number;
  inputs: MissionControllerInputs;
  safetyNotice: string;
  liveLocked: true;
  canAutoReduceRisk: true;
  cannotAutoIncreaseLiveRisk: true;
}

export interface MissionControllerEvaluateContext {
  deskRiskProfile?: DeskRiskProfile;
}
