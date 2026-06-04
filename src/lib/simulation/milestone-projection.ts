import {
  buildMissionStages,
  MISSION_GOAL_USD,
} from "@/lib/capital/capital-mission-config";
import type { MilestoneProjectionOutput } from "./types";
import type { CapitalRiskSimulatorInput } from "./types";

const STAGE_SPLITS = [
  { reserve: 50, core: 35, growth: 10, experimental: 5, note: "Foundation stage — protect capital while proving edge on paper." },
  { reserve: 40, core: 40, growth: 15, experimental: 5, note: "First double — shift modestly into growth sleeve." },
  { reserve: 35, core: 40, growth: 20, experimental: 5, note: "Mid-ladder — core strategies carry book." },
  { reserve: 30, core: 45, growth: 20, experimental: 5, note: "Upper mid — reserve drops as track record deepens." },
  { reserve: 25, core: 45, growth: 25, experimental: 5, note: "Pre-goal — growth allocation rises." },
  { reserve: 20, core: 40, growth: 30, experimental: 10, note: "Mission goal band — controlled experiment sleeve." },
];

function findStageIndex(equity: number): number {
  const stages = buildMissionStages();
  let idx = 0;
  for (let i = stages.length - 1; i >= 0; i--) {
    if (equity >= stages[i].floorUsd) {
      idx = i;
      break;
    }
  }
  return idx;
}

export function runMilestoneProjection(input: {
  currentEquity: number;
  winRate: number;
  averageWinR: number;
  averageLossR: number;
  riskPerTradePct: number;
  probabilityReachTarget?: number;
}): MilestoneProjectionOutput {
  const stages = buildMissionStages();
  const stageIndex = findStageIndex(input.currentEquity);
  const current = stages[stageIndex];
  const nextFloor = current.nextFloorUsd;
  const distance =
    nextFloor != null ? Math.max(0, nextFloor - input.currentEquity) : 0;

  const edgeR =
    input.winRate * input.averageWinR -
    (1 - input.winRate) * input.averageLossR;
  const perTradeGrowth =
    edgeR > 0 ? (input.riskPerTradePct / 100) * edgeR : 0;

  const estimatedTrades =
    nextFloor != null && perTradeGrowth > 0 && input.currentEquity > 0
      ? Math.ceil(
          Math.log(nextFloor / input.currentEquity) / Math.log(1 + perTradeGrowth / 100),
        )
      : null;

  const prob =
    input.probabilityReachTarget != null
      ? Math.min(99, input.probabilityReachTarget * (nextFloor ? 0.6 : 1))
      : edgeR > 0
        ? Math.min(85, 40 + input.winRate * 50)
        : 12;

  let riskLevel: MilestoneProjectionOutput["riskLevel"] = "low";
  if (prob < 25 || edgeR <= 0) riskLevel = "critical";
  else if (prob < 45) riskLevel = "high";
  else if (prob < 65) riskLevel = "moderate";

  const splitTemplate =
    STAGE_SPLITS[Math.min(stageIndex, STAGE_SPLITS.length - 1)] ?? STAGE_SPLITS[0];

  return {
    currentStageLabel: current.label,
    stageIndex,
    nextMilestoneUsd: nextFloor ?? MISSION_GOAL_USD,
    distanceToNextUsd: nextFloor != null ? distance : null,
    estimatedTradesToNext: estimatedTrades,
    probabilityNextMilestone: Number(prob.toFixed(1)),
    riskLevel,
    recommendedSplit: {
      reservePct: splitTemplate.reserve,
      coreStrategyPct: splitTemplate.core,
      growthStrategyPct: splitTemplate.growth,
      experimentalPct: splitTemplate.experimental,
      note: splitTemplate.note,
    },
  };
}

export function defaultCapitalRiskInput(
  overrides: Partial<CapitalRiskSimulatorInput> = {},
): CapitalRiskSimulatorInput {
  return {
    startingEquity: 1_000,
    targetEquity: 20_000,
    currentEquity: 1_000,
    winRate: 0.52,
    averageWinR: 1.2,
    averageLossR: 1,
    riskPerTradePct: 2,
    maxTradesPerDay: 2,
    maxDailyLossPct: 3,
    maxWeeklyLossPct: 6,
    maxDrawdownPct: 12,
    simulationRuns: 500,
    maxTrades: 200,
    ...overrides,
  };
}
