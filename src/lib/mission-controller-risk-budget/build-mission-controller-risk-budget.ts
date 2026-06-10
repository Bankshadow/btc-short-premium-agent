import { GOAL_START_CAPITAL, GOAL_TARGET_CAPITAL } from "@/lib/goal-engine/types";
import {
  dailyLossLimitHit,
  dailyPnlStressed,
  deriveMissionNextAction,
  resolveMissionMode,
} from "./resolve-mission-mode";
import type {
  MissionControllerRiskBudgetBuildInput,
  MissionControllerRiskBudgetSnapshot,
} from "./types";
import {
  MISSION_CONTROLLER_RISK_BUDGET_LABEL,
  MISSION_CONTROLLER_RISK_BUDGET_MVP,
} from "./types";

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function capRecommendedLimits(input: {
  recommendedMaxNotional: number;
  recommendedRiskPerTrade: number;
  recommendedDailyLossLimit: number;
  recommendedMaxOpenPositions: number;
  currentMaxNotional: number;
  currentDailyLossLimitPct: number;
  currentMaxOpenPositions: number;
  missionMode: ReturnType<typeof resolveMissionMode>["mode"];
}): {
  recommendedMaxNotional: number;
  recommendedRiskPerTrade: number;
  recommendedDailyLossLimit: number;
  recommendedMaxOpenPositions: number;
} {
  let {
    recommendedMaxNotional,
    recommendedRiskPerTrade,
    recommendedDailyLossLimit,
    recommendedMaxOpenPositions,
  } = input;

  if (input.missionMode === "PAUSED") {
    recommendedMaxOpenPositions = 0;
    recommendedMaxNotional = Math.min(
      recommendedMaxNotional,
      input.currentMaxNotional * 0.5,
    );
    recommendedRiskPerTrade = Math.min(recommendedRiskPerTrade, 1);
  }

  recommendedMaxNotional = Math.min(
    recommendedMaxNotional,
    input.currentMaxNotional,
  );
  recommendedRiskPerTrade = Math.min(
    recommendedRiskPerTrade,
    2.5,
  );
  recommendedDailyLossLimit = Math.min(
    recommendedDailyLossLimit,
    -Math.abs(input.currentDailyLossLimitPct),
  );

  return {
    recommendedMaxNotional,
    recommendedRiskPerTrade,
    recommendedDailyLossLimit,
    recommendedMaxOpenPositions,
  };
}

export function buildMissionControllerRiskBudget(
  input: MissionControllerRiskBudgetBuildInput,
): MissionControllerRiskBudgetSnapshot {
  const rb = input.integratedRiskBudget;
  const rec = rb.recommendation;
  const analysis = rb.analysis;

  const startEquity = GOAL_START_CAPITAL;
  const targetEquity = input.targetEquity ?? GOAL_TARGET_CAPITAL;
  const currentEquity =
    input.currentEquity ?? startEquity + (input.dailyPnlUsd ?? 0);
  const progressPct =
    targetEquity > startEquity
      ? Math.max(
          0,
          Math.min(
            100,
            ((currentEquity - startEquity) / (targetEquity - startEquity)) * 100,
          ),
        )
      : 0;

  const maxDrawdownUsd = input.maxDrawdownUsd ?? 0;
  const drawdownPct =
    startEquity > 0 ? round((maxDrawdownUsd / startEquity) * 100, 1) : 0;
  const dailyPnlUsd = input.dailyPnlUsd ?? 0;
  const dailyPnlPct =
    currentEquity > 0 ? round((dailyPnlUsd / currentEquity) * 100, 2) : 0;
  const losingStreak = input.losingStreak ?? 0;

  const lossLimitHit = dailyLossLimitHit(dailyPnlPct);
  const pnlStressed = dailyPnlStressed(dailyPnlPct);

  const { mode: missionMode, reason: modeReason } = resolveMissionMode({
    dailyLossLimitHit: lossLimitHit,
    automationPaused: input.automationPaused ?? false,
    criticalIncidentOpen: input.criticalIncidentOpen ?? false,
    losingStreak,
    dailyPnlStressed: pnlStressed,
    strategyStatus: analysis.strategyHealthStatus,
    blocksNewTestnetEntries: input.blocksNewTestnetEntries ?? false,
    riskBudgetMode: rec.mode,
    drawdownPct,
    overconfidence: analysis.overconfidenceDetected,
    avgQuality: analysis.avgTradeQualityScore,
    evidenceReady:
      analysis.evidenceCompletedTrades >= analysis.evidenceRequired,
    readinessBlocked: rb.analysis.governanceWarningRecommended,
  });

  const capped = capRecommendedLimits({
    recommendedMaxNotional: rec.recommendedMaxNotional,
    recommendedRiskPerTrade: rec.recommendedRiskPerTrade,
    recommendedDailyLossLimit: rec.recommendedDailyLossLimit,
    recommendedMaxOpenPositions: rec.recommendedMaxOpenPositions,
    currentMaxNotional: rec.currentMaxNotional,
    currentDailyLossLimitPct: rec.currentDailyLossLimitPct,
    currentMaxOpenPositions: rec.currentMaxOpenPositions,
    missionMode,
  });

  const humanApprovalRequired = true as const;
  const humanApprovalReason =
    capped.recommendedMaxNotional < rec.currentMaxNotional
      ? "AI may recommend lowering limits — apply in Settings. Risk increases always require operator approval."
      : "Risk limit increases require operator approval in Settings — AI cannot raise live risk automatically.";

  const reasons = [
    modeReason,
    ...rec.reasons.filter((r) => r !== modeReason),
  ].slice(0, 6);

  const nextAction = deriveMissionNextAction({
    missionMode,
    progressPct,
    modeReason,
  });

  return {
    mvp: MISSION_CONTROLLER_RISK_BUDGET_MVP,
    label: MISSION_CONTROLLER_RISK_BUDGET_LABEL,
    missionMode,
    modeReason,
    nextAction,
    humanApprovalRequired,
    humanApprovalReason,
    recommendedRiskPerTrade: capped.recommendedRiskPerTrade,
    recommendedMaxNotional: capped.recommendedMaxNotional,
    recommendedDailyLossLimit: capped.recommendedDailyLossLimit,
    recommendedMaxOpenPositions: capped.recommendedMaxOpenPositions,
    currentMaxNotional: rec.currentMaxNotional,
    currentDailyLossLimitPct: rec.currentDailyLossLimitPct,
    currentMaxOpenPositions: rec.currentMaxOpenPositions,
    cannotIncreaseLiveRiskAutomatically: true,
    liveTradingLocked: true,
    autoApplyAllowed: false,
    reasons,
    inputs: {
      currentEquity: round(currentEquity),
      targetEquity,
      progressPct: round(progressPct, 1),
      winRate: input.winRate ?? null,
      losingStreak,
      maxDrawdownUsd: round(maxDrawdownUsd),
      maxDrawdownPct: drawdownPct,
      dailyPnlUsd: round(dailyPnlUsd),
      dailyPnlPct,
      openExposureUsd: round(input.openExposureUsd ?? 0),
      openPositionCount: input.openPositionCount ?? 0,
      incidentOpenCount: input.incidentOpenCount ?? 0,
      criticalIncidentOpen: input.criticalIncidentOpen ?? false,
      strategyHealthStatus: analysis.strategyHealthStatus,
      overconfidenceDetected: analysis.overconfidenceDetected,
      avgTradeQualityScore: analysis.avgTradeQualityScore,
      evidenceCompletedTrades: analysis.evidenceCompletedTrades,
      evidenceRequired: analysis.evidenceRequired,
    },
    riskBudget: rb,
    lastUpdatedAt: new Date().toISOString(),
  };
}
