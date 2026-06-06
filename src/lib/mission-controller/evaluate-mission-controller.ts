import { buildGoalDashboardServerPayload } from "@/lib/goal-engine/build-server-context";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { getParallelTaskRunnerSnapshot } from "@/lib/parallel-task-runner/run-parallel-review";
import { getLoopGuardDashboardSnapshot } from "@/lib/autopilot-loop-guard/run-guard";
import { getDeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { evaluateRealTimeRisk } from "@/lib/real-time-risk/evaluate-realtime-risk";
import { buildStrategyHealthSignal } from "@/lib/strategy-health";
import { resolvePrimaryStrategyHealth } from "@/lib/mission-flow/resolve-primary-strategy-health";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { filterProductionEntries } from "@/lib/journal/production-filter";
import {
  CORE_STRATEGY_TYPES,
  FULL_STRATEGY_TYPES,
  MISSION_CONFIDENCE_DEFENSIVE,
  MISSION_CONFIDENCE_OPPORTUNITY,
  MISSION_DRAWDOWN_DEFENSIVE_PCT,
  RECOVERY_STRATEGY_TYPES,
  losingStreakThreshold,
} from "./config";
import { computeAiConfidence } from "./compute-confidence";
import type {
  MissionControllerInputs,
  MissionControllerMode,
  MissionControllerResult,
  MissionRiskLevel,
  MissionTradeFrequency,
} from "./types";
import { MISSION_CONTROLLER_SAFETY_NOTICE } from "./types";
import { getCachedCalibrationProfile } from "@/lib/confidence-calibration/calibration-cache";
import { loadCalibrationStore } from "@/lib/confidence-calibration/calibration-store";
import { buildTradeQualitySummary } from "@/lib/trade-quality-score/build-summary";
import { loadTradeQualityStore } from "@/lib/trade-quality-score/quality-store";
import {
  applyCalibratedConfidence,
  calibrationPenaltyPoints,
} from "@/lib/confidence-calibration/apply-calibration";

function deriveMode(input: MissionControllerInputs): {
  mode: MissionControllerMode;
  reason: string;
} {
  if (input.automationPaused) {
    return { mode: "PAUSED", reason: "Autopilot paused by operator." };
  }
  if (input.dailyLossLimitHit) {
    return { mode: "PAUSED", reason: "Daily loss limit reached — trading halted." };
  }
  if (input.riskStatus === "EMERGENCY" || input.riskStatus === "BLOCKED") {
    return { mode: "PAUSED", reason: `Risk engine ${input.riskStatus.toLowerCase()} — new trades blocked.` };
  }
  if (input.loopGuardActive) {
    return { mode: "PAUSED", reason: "Autopilot loop guard active — resolve blocker first." };
  }
  if (input.committeePause) {
    return { mode: "PAUSED", reason: "Agent committee recommends pause and review." };
  }

  const losingStreak = input.losingStreak < 0 ? Math.abs(input.losingStreak) : 0;
  if (losingStreak >= losingStreakThreshold()) {
    return {
      mode: "RECOVERY",
      reason: `Losing streak ${losingStreak} trades — recovery sizing and core strategies only.`,
    };
  }

  if (input.completedTrades === 0) {
    return {
      mode: "NORMAL",
      reason: "Learning phase — no completed trades yet; gather trust sample in NORMAL mode.",
    };
  }

  if (
    input.drawdownPct >= MISSION_DRAWDOWN_DEFENSIVE_PCT ||
    input.weeklyPnlPct <= -5 ||
    input.aiConfidence < MISSION_CONFIDENCE_DEFENSIVE ||
    input.riskStatus === "CAUTION"
  ) {
    return {
      mode: "DEFENSIVE",
      reason: "Elevated drawdown, weak confidence, or caution risk — defensive posture.",
    };
  }

  if (
    input.trustReady &&
    input.aiConfidence >= MISSION_CONFIDENCE_OPPORTUNITY &&
    input.riskStatus === "SAFE" &&
    input.dailyPnlPct >= 0 &&
    input.losingStreak >= 0
  ) {
    return {
      mode: "OPPORTUNITY",
      reason: "Trust met, safe risk, and positive momentum — opportunity window.",
    };
  }

  return { mode: "NORMAL", reason: "Mission on track — standard operating mode." };
}

function deriveRiskLevel(
  mode: MissionControllerMode,
  deskProfile: ReturnType<typeof getDeskRiskProfile>,
): { level: MissionRiskLevel; requiresApproval: boolean } {
  if (mode === "PAUSED" || mode === "RECOVERY" || mode === "DEFENSIVE") {
    return { level: "CONSERVATIVE", requiresApproval: false };
  }
  if (mode === "OPPORTUNITY" && deskProfile === "aggressive") {
    return { level: "AGGRESSIVE", requiresApproval: true };
  }
  if (mode === "OPPORTUNITY") {
    return { level: "BALANCED", requiresApproval: false };
  }
  return { level: "BALANCED", requiresApproval: false };
}

function deriveTradeFrequency(mode: MissionControllerMode): MissionTradeFrequency {
  switch (mode) {
    case "PAUSED":
      return "PAUSED";
    case "RECOVERY":
    case "DEFENSIVE":
      return "LOW";
    case "OPPORTUNITY":
      return "ELEVATED";
    default:
      return "NORMAL";
  }
}

function deriveAllowedStrategies(mode: MissionControllerMode): string[] {
  switch (mode) {
    case "PAUSED":
      return [];
    case "RECOVERY":
      return [...RECOVERY_STRATEGY_TYPES];
    case "DEFENSIVE":
      return [...CORE_STRATEGY_TYPES];
    case "OPPORTUNITY":
      return [...FULL_STRATEGY_TYPES];
    default:
      return [...CORE_STRATEGY_TYPES];
  }
}

function deriveNextAction(input: {
  mode: MissionControllerMode;
  humanActionRequired: boolean;
  pendingTestnetPreview: boolean;
  modeReason: string;
}): string {
  if (input.pendingTestnetPreview) {
    return "Approve or deny pending testnet preview (double confirm).";
  }
  if (input.humanActionRequired) {
    return "Operator approval required before next testnet action.";
  }
  switch (input.mode) {
    case "PAUSED":
      return "Clear blocker or resume autopilot when risk is safe.";
    case "RECOVERY":
      return "Trade smaller size on core strategies until streak resets.";
    case "DEFENSIVE":
      return "Monitor positions; avoid new risk until metrics improve.";
    case "OPPORTUNITY":
      return "Execute committee signals within trust notional limits.";
    default:
      return "Continue scheduled autopilot cycles toward $10k target.";
  }
}

export async function evaluateMissionController(): Promise<MissionControllerResult> {
  if (!getCachedCalibrationProfile()) {
    await loadCalibrationStore().catch(() => null);
  }

  const [payload, flow, parallel, loopGuard, entriesRaw] = await Promise.all([
    buildGoalDashboardServerPayload(),
    buildMissionFlowServerSnapshot().catch(() => null),
    getParallelTaskRunnerSnapshot().catch(() => null),
    getLoopGuardDashboardSnapshot().catch(() => null),
    loadServerAnalysisJournal().catch(() => []),
  ]);

  const goal = payload.goal;
  const mission = payload.mission;
  const entries = filterProductionEntries(entriesRaw);
  const tradeQualityStore = await loadTradeQualityStore().catch(() => null);
  const tradeQualitySummary = tradeQualityStore
    ? buildTradeQualitySummary(tradeQualityStore.scores)
    : null;
  const strategySignal = buildStrategyHealthSignal(
    payload.strategyHealth,
    tradeQualitySummary && tradeQualitySummary.sampleCount > 0
      ? {
          avgCompositeScore: tradeQualitySummary.avgCompositeScore,
          avgGrade: tradeQualitySummary.avgGrade,
        }
      : undefined,
  );
  const riskReport = evaluateRealTimeRisk({
    entries,
    orders: [],
    strategyHealthSignal: strategySignal,
  });

  const lastAnalyze = payload.automation?.state.lastRun?.analyze ?? null;
  const committeeRec = parallel?.lastRun?.committee?.recommendation ?? null;
  const primaryStrategy = resolvePrimaryStrategyHealth(payload.strategyHealth);
  const calibrationProfile = getCachedCalibrationProfile();
  const rawStep5 = lastAnalyze?.step5_verdict?.confidence ?? null;
  const calibratedStep5 =
    rawStep5 != null ? applyCalibratedConfidence(rawStep5, calibrationProfile) : null;
  const calibrationPenalty =
    rawStep5 != null ? calibrationPenaltyPoints(rawStep5, calibrationProfile) : 0;
  const tradeQualityPenalty =
    tradeQualitySummary && tradeQualitySummary.avgCompositeScore < 50
      ? 12
      : tradeQualitySummary && tradeQualitySummary.avgCompositeScore < 60
        ? 6
        : 0;
  const aiConfidence = computeAiConfidence({
    strategyHealthScore: strategySignal.healthScorePct,
    tradeAllowed: primaryStrategy?.tradeAllowed ?? true,
    committeeRecommendation: committeeRec,
    dataTrustScore: lastAnalyze?.dataTrust?.score ?? null,
    dataTrustGrade: lastAnalyze?.dataTrust?.grade ?? null,
    step5Confidence: calibratedStep5 ?? rawStep5,
    committeeConfidence: lastAnalyze?.tradingDesk?.weightedCommittee?.tradeScore ?? null,
    calibrationPenalty: calibrationPenalty + tradeQualityPenalty,
  });

  const losingStreak =
    goal.tradeStats.currentStreak < 0 ? goal.tradeStats.currentStreak : 0;
  const drawdownUsd = goal.tradeStats.maxDrawdown;
  const drawdownPct =
    goal.mission.startCapital > 0
      ? (drawdownUsd / goal.mission.startCapital) * 100
      : 0;

  const dailyLossLimitHit =
    riskReport.blockNewTrades ||
    riskReport.metrics.dailyPnlPct <= -3 ||
    goal.risk.dailyLossStatus.toLowerCase().includes("limit reached");

  const inputs: MissionControllerInputs = {
    currentEquity: goal.mission.currentEquity,
    targetEquity: goal.mission.targetCapital,
    startEquity: goal.mission.startCapital,
    dailyPnlPct: riskReport.metrics.dailyPnlPct,
    weeklyPnlPct: riskReport.metrics.weeklyPnlPct,
    drawdownUsd,
    drawdownPct: Math.round(drawdownPct * 10) / 10,
    winRate: goal.tradeStats.winRate,
    losingStreak,
    openExposureUsd: goal.equity.openExposureUsd,
    aiConfidence,
    riskStatus: riskReport.riskStatus,
    dailyLossLimitHit,
    completedTrades: goal.tradeStats.totalTrades,
    trustReady: goal.trustReady,
    automationPaused: Boolean(payload.automation?.state.settings.paused),
    committeePause: committeeRec === "PAUSE_AND_REVIEW",
    loopGuardActive: Boolean(loopGuard?.blocker?.active || loopGuard?.decision?.stopLoop),
    pendingTestnetPreview: Boolean(
      flow?.snapshot.pendingTestnetPreview && !flow.snapshot.pendingTestnetPreview.blocked,
    ),
    humanActionRequired: mission.humanActionRequired,
  };

  const { mode, reason: modeReason } = deriveMode(inputs);
  const deskProfile = getDeskRiskProfile();
  const { level: recommendedRiskLevel, requiresApproval: riskLevelRequiresApproval } =
    deriveRiskLevel(mode, deskProfile);

  const humanApprovalNeeded =
    inputs.humanActionRequired ||
    inputs.pendingTestnetPreview ||
    riskLevelRequiresApproval ||
    (recommendedRiskLevel === "AGGRESSIVE" && deskProfile !== "aggressive");

  const humanApprovalReason = humanApprovalNeeded
    ? inputs.pendingTestnetPreview
      ? "Pending testnet execute requires double confirm."
      : riskLevelRequiresApproval
        ? "Raising risk to aggressive requires operator approval."
        : inputs.humanActionRequired
          ? mission.nextAction
          : null
    : null;

  return {
    generatedAt: new Date().toISOString(),
    mode,
    modeReason,
    recommendedRiskLevel,
    riskLevelRequiresApproval,
    tradeFrequency: deriveTradeFrequency(mode),
    allowedStrategyTypes: deriveAllowedStrategies(mode),
    nextAction: deriveNextAction({
      mode,
      humanActionRequired: inputs.humanActionRequired,
      pendingTestnetPreview: inputs.pendingTestnetPreview,
      modeReason,
    }),
    humanApprovalNeeded,
    humanApprovalReason,
    aiConfidence,
    inputs,
    safetyNotice: MISSION_CONTROLLER_SAFETY_NOTICE,
    liveLocked: true,
    canAutoReduceRisk: true,
    cannotAutoIncreaseLiveRisk: true,
  };
}
