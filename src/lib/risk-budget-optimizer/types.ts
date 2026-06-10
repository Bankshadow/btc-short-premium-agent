import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";
import type { RegimeBrainResult } from "@/lib/market-regime-brain/types";
import type { UnifiedPortfolioSnapshot } from "@/lib/portfolio/unified-types";
import type { LivePilotRiskConfig } from "@/lib/live-pilot/types";
import type { KillSwitchStatus } from "@/lib/validation/validation-types";
import type { StrategyId } from "@/lib/validation/validation-types";
import type { DataConfidenceResult, ConflictGateResult } from "@/lib/data-trust/types";

export const RISK_BUDGET_SAFETY_NOTICE =
  "Risk Budget Optimizer may reduce size automatically. It cannot increase live risk beyond governance max, override kill switch, or bypass human approval.";

export interface StrategyRiskSlice {
  strategyId: StrategyId | string;
  label: string;
  allocatedPct: number;
  openExposurePct: number;
  recommendedPct: number;
}

export interface AssetRiskSlice {
  asset: string;
  allocatedPct: number;
  openExposurePct: number;
  recommendedPct: number;
}

export interface RiskBudgetTimelinePoint {
  timestamp: string;
  equityUsd: number;
  openExposurePct: number;
  budgetUsedPct: number;
  drawdownPct: number;
}

export interface RiskBudgetResult {
  generatedAt: string;
  recommendedRiskPct: number;
  maxAllowedRiskPct: number;
  recommendedPositionSizeUsd: number;
  sizeReductionReasons: string[];
  riskBudgetRemainingPct: number;
  strategyRiskAllocation: StrategyRiskSlice[];
  assetRiskAllocation: AssetRiskSlice[];
  liveTradingAllowed: boolean;
  blockReasons: string[];
  dailyLossLimitPct: number;
  weeklyLossLimitPct: number;
  dailyLossUsedPct: number;
  weeklyLossUsedPct: number;
  timeline: RiskBudgetTimelinePoint[];
  canReduceAutomatically: true;
  cannotIncreaseBeyondGovernanceMax: true;
  cannotOverrideKillSwitch: true;
  cannotBypassApproval: true;
  safetyNotice: string;
}

export interface RiskBudgetInput {
  portfolio: UnifiedPortfolioSnapshot;
  baseSizePct: number;
  currentEquity?: number;
  deskRiskProfile?: DeskRiskProfile;
  regimeBrain?: RegimeBrainResult | null;
  agentConfidence?: number;
  agentConflictLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "NONE";
  dataTrust?: DataConfidenceResult | null;
  conflictGate?: ConflictGateResult | null;
  killSwitch?: KillSwitchStatus | null;
  governance?: GovernanceAnalyzePayload | null;
  pilotConfig?: LivePilotRiskConfig | null;
  recentLossStreak?: number;
  /** MVP 83 — capped at 1.0; reduces size only when overconfident. */
  confidenceCalibrationMultiplier?: number;
  /** MVP 77 — integrated calibration recommendation (reduce-only). */
  confidenceCalibrationRecommendation?: string | null;
  strategyPerformance?: Array<{
    strategyId: string;
    winRate: number;
    sampleSize: number;
  }>;
}
