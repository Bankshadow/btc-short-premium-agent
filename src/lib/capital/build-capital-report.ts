import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { buildDeskPortfolioSnapshot } from "@/lib/portfolio/milestones";
import { buildValidationReport } from "@/lib/validation/build-validation-report";
import { loadCapitalSettings, type CapitalMissionSettings } from "./capital-settings";
import {
  buildCapitalStageSnapshot,
  computeSimulatedReturnPct,
} from "./capital-stage-tracker";
import { buildCapitalSplitRecommendation } from "./capital-split-engine";
import { buildDeskScalePermission } from "./scale-permission";
import { buildRiskOfRuinWarning } from "./risk-of-ruin";
import type { CapitalReport } from "./capital-types";
import {
  MISSION_GOAL_USD,
  MISSION_STAGE_FLOORS_USD,
} from "./capital-mission-config";

export function buildCapitalReport(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  riskProfile: DeskRiskProfile;
  latestAnalysis?: AnalyzeApiResponse | null;
  settings?: CapitalMissionSettings;
}): CapitalReport {
  const settings = input.settings ?? loadCapitalSettings();
  const portfolio = buildDeskPortfolioSnapshot(input.entries, input.orders);
  const validation = buildValidationReport({
    entries: input.entries,
    orders: input.orders,
    riskProfile: input.riskProfile,
    latestAnalysis: input.latestAnalysis,
  });

  const stage = buildCapitalStageSnapshot({ settings, portfolio });
  const split = buildCapitalSplitRecommendation({
    stage,
    validationAllocation: validation.capitalAllocation,
  });
  const scalePermission = buildDeskScalePermission({
    strategyMatrix: validation.strategyMatrix,
    killSwitch: validation.killSwitch,
    entries: input.entries,
  });
  const riskOfRuin = buildRiskOfRuinWarning({
    portfolio,
    killSwitch: validation.killSwitch,
    stage,
  });

  return {
    generatedAt: new Date().toISOString(),
    analysisOnly: true,
    stage,
    split,
    scalePermission,
    riskOfRuin,
    simulatedReturnPct: computeSimulatedReturnPct(portfolio),
    missionStartUsd: settings.missionStartUsd,
  };
}

export function capitalMissionMeta() {
  return {
    mvp: 12,
    analysisOnly: true,
    goalUsd: MISSION_GOAL_USD,
    stageFloorsUsd: [...MISSION_STAGE_FLOORS_USD],
    disclaimer:
      "Planning and simulation only. No real fund transfers or exchange subaccounts.",
  };
}
