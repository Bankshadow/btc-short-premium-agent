import type { DeskPortfolioSnapshot } from "@/lib/portfolio/portfolio-types";
import {
  MISSION_GOAL_USD,
  buildMissionStages,
} from "./capital-mission-config";
import type { CapitalMissionSettings } from "./capital-settings";
import type { CapitalStageSnapshot } from "./capital-types";

export function computeSimulatedReturnPct(
  portfolio: DeskPortfolioSnapshot,
): number {
  const paper = portfolio.paper;
  return Number(
    (paper.totalRealizedPnlPct + paper.totalUnrealizedPnlPct * 0.35 + portfolio.netLogPaperPnlPct * 0.65).toFixed(
      2,
    ),
  );
}

export function computeSimulatedEquityUsd(
  settings: CapitalMissionSettings,
  portfolio: DeskPortfolioSnapshot,
): number {
  if (!settings.useSimulatedEquity) {
    return Math.max(0, settings.manualEquityUsd);
  }
  const ret = computeSimulatedReturnPct(portfolio);
  return Math.round(settings.missionStartUsd * (1 + ret / 100));
}

export function buildCapitalStageSnapshot(input: {
  settings: CapitalMissionSettings;
  portfolio: DeskPortfolioSnapshot;
}): CapitalStageSnapshot {
  const stages = buildMissionStages();
  const equityUsd = computeSimulatedEquityUsd(input.settings, input.portfolio);
  const start = input.settings.missionStartUsd;

  let stageIndex = 0;
  for (let i = stages.length - 1; i >= 0; i--) {
    if (equityUsd >= stages[i].floorUsd) {
      stageIndex = i;
      break;
    }
  }

  const current = stages[stageIndex];
  const nextMilestone =
    current.nextFloorUsd != null
      ? stages[Math.min(stageIndex + 1, stages.length - 1)]
      : null;

  const stageFloor = current.floorUsd;
  const stageCeiling = current.ceilingUsd ?? MISSION_GOAL_USD;
  const span = Math.max(1, stageCeiling - stageFloor);
  const progressInStagePct = Math.min(
    100,
    Math.max(0, ((equityUsd - stageFloor) / span) * 100),
  );

  const progressToGoalPct = Math.min(
    100,
    Math.max(0, ((equityUsd - start) / (MISSION_GOAL_USD - start)) * 100),
  );

  const distanceToNextUsd =
    current.nextFloorUsd != null
      ? Math.max(0, current.nextFloorUsd - equityUsd)
      : null;

  const distanceToGoalUsd = Math.max(0, MISSION_GOAL_USD - equityUsd);
  const doubledSinceLastStage = equityUsd >= stageFloor * 2;

  return {
    current,
    stageIndex,
    totalStages: stages.length,
    nextMilestone:
      nextMilestone && nextMilestone.floorUsd > equityUsd
        ? nextMilestone
        : current.ceilingUsd == null
          ? null
          : nextMilestone,
    distanceToNextUsd,
    distanceToGoalUsd,
    progressInStagePct: Number(progressInStagePct.toFixed(1)),
    progressToGoalPct: Number(progressToGoalPct.toFixed(1)),
    equityUsd,
    missionStartUsd: start,
    missionGoalUsd: MISSION_GOAL_USD,
    doubledSinceLastStage,
    stageEntryUsd: stageFloor,
  };
}
