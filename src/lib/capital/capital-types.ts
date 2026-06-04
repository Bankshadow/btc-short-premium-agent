import type { StrategyId } from "@/lib/validation/validation-types";
import type { CapitalAllocationRecommendation } from "@/lib/validation/validation-types";

export interface CapitalMissionStage {
  id: string;
  label: string;
  floorUsd: number;
  ceilingUsd: number | null;
  /** Next stage floor, or null at mission cap */
  nextFloorUsd: number | null;
}

export interface CapitalStageSnapshot {
  current: CapitalMissionStage;
  stageIndex: number;
  totalStages: number;
  nextMilestone: CapitalMissionStage | null;
  distanceToNextUsd: number | null;
  distanceToGoalUsd: number;
  progressInStagePct: number;
  progressToGoalPct: number;
  equityUsd: number;
  missionStartUsd: number;
  missionGoalUsd: number;
  doubledSinceLastStage: boolean;
  stageEntryUsd: number;
}

export interface CapitalSplitBucket {
  key: "protected_reserve" | "core_strategy" | "growth_strategy" | "experimental";
  label: string;
  pct: number;
  amountUsd: number;
  note: string;
}

export interface CapitalSplitRecommendation {
  buckets: CapitalSplitBucket[];
  totalPct: number;
  trigger: string;
  summary: string;
  /** Blended with MVP 10 validation allocation */
  validationAllocation: CapitalAllocationRecommendation;
}

export interface ScalePermissionCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface StrategyScalePermission {
  strategyId: StrategyId;
  label: string;
  allowed: boolean;
  checks: ScalePermissionCheck[];
  blockedReason: string | null;
}

export interface DeskScalePermission {
  allowed: boolean;
  checks: ScalePermissionCheck[];
  blockedReason: string | null;
  strategyPermissions: StrategyScalePermission[];
}

export interface RiskOfRuinWarning {
  level: "low" | "moderate" | "high" | "critical";
  score: number;
  headline: string;
  factors: string[];
  disclaimer: string;
}

export interface CapitalReport {
  generatedAt: string;
  analysisOnly: true;
  stage: CapitalStageSnapshot;
  split: CapitalSplitRecommendation;
  scalePermission: DeskScalePermission;
  riskOfRuin: RiskOfRuinWarning;
  simulatedReturnPct: number;
  missionStartUsd: number;
}
