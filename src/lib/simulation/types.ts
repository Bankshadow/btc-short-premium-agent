export interface CapitalRiskSimulatorInput {
  startingEquity: number;
  targetEquity: number;
  currentEquity: number;
  winRate: number;
  averageWinR: number;
  averageLossR: number;
  riskPerTradePct: number;
  maxTradesPerDay: number;
  maxDailyLossPct: number;
  maxWeeklyLossPct: number;
  maxDrawdownPct: number;
  simulationRuns: number;
  maxTrades: number;
}

export interface CapitalRiskSimulatorOutput {
  probabilityReachTarget: number;
  probabilityRuin: number;
  medianEndingEquity: number;
  expectedMaxDrawdown: number;
  bestCaseEquity: number;
  baseCaseEquity: number;
  worstCaseEquity: number;
  expectedTradesToNextMilestone: number;
  recommendedRiskPct: number;
  warnings: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  sampleSizeNote?: string;
}

export interface MilestoneProjectionOutput {
  currentStageLabel: string;
  stageIndex: number;
  nextMilestoneUsd: number | null;
  distanceToNextUsd: number | null;
  estimatedTradesToNext: number | null;
  probabilityNextMilestone: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  recommendedSplit: {
    reservePct: number;
    coreStrategyPct: number;
    growthStrategyPct: number;
    experimentalPct: number;
    note: string;
  };
}

export type DrawdownScenarioId =
  | "three_losses"
  | "five_losses"
  | "ten_losses"
  | "volatile_week"
  | "aggressive_failure";

export interface DrawdownStressResult {
  scenarioId: DrawdownScenarioId;
  label: string;
  endingEquity: number;
  drawdownPct: number;
  cooldownRecommendation: string;
  killSwitchTrigger: boolean;
}

export interface DrawdownSimulatorOutput {
  startingEquity: number;
  results: DrawdownStressResult[];
}

export type RuleImpactRecommendation =
  | "APPROVE_FOR_PAPER_TEST"
  | "REJECT"
  | "NEED_MORE_DATA";

export interface RuleImpactSimulatorOutput {
  ruleId: string;
  affectedDecisions: number;
  blockedWinningTrades: number;
  blockedLosingTrades: number;
  allowedWinningTrades: number;
  allowedLosingTrades: number;
  netImpactR: number;
  recommendation: RuleImpactRecommendation;
  explanation: string;
}
