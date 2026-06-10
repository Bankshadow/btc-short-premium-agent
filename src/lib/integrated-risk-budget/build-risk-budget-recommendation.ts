import {
  BINANCE_MIN_NOTIONAL_USD,
} from "@/lib/exchange/binance/trust-scaled-notional";
import type { IntegratedConfidenceCalibrationSnapshot } from "@/lib/integrated-confidence-calibration/types";
import type { IntegratedStrategyHealthSnapshot } from "@/lib/integrated-strategy-health/types";
import type { MicroLiveReadinessSnapshot } from "@/lib/micro-live-readiness/types";
import type { EvidenceProgressSnapshot } from "@/lib/evidence-progress/types";
import type { IntegratedTradeQualitySnapshot } from "@/lib/trade-quality-score/types";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import type {
  RiskBudgetAnalysis,
  RiskBudgetMode,
  RiskBudgetRecommendation,
} from "./types";

const GOVERNANCE_MAX_RISK_PCT = 2.5;
const DEFAULT_MAX_OPEN = 1;

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function resolveMode(input: {
  strategyStatus: string | null;
  overconfidence: boolean;
  evidenceReady: boolean;
  avgQuality: number | null;
  dailyPnlStressed: boolean;
  blocksNewEntries: boolean;
  readinessBlocked: boolean;
}): RiskBudgetMode {
  if (
    input.blocksNewEntries ||
    input.readinessBlocked ||
    input.strategyStatus === "PAUSE" ||
    input.strategyStatus === "REJECT" ||
    input.dailyPnlStressed
  ) {
    return "COOLDOWN";
  }
  if (
    input.overconfidence ||
    input.strategyStatus === "REDUCE_RISK" ||
    (input.avgQuality != null && input.avgQuality < 55) ||
    !input.evidenceReady
  ) {
    return "DEFENSIVE";
  }
  if (
    input.evidenceReady &&
    input.strategyStatus === "CONTINUE" &&
    !input.overconfidence &&
    (input.avgQuality == null || input.avgQuality >= 68)
  ) {
    return "OPPORTUNITY";
  }
  return "NORMAL";
}

export function buildRiskBudgetRecommendation(input: {
  configuredMaxNotional: number;
  trustNotionalUsd: number;
  currentDailyLossLimitPct?: number;
  currentMaxOpenPositions?: number;
  evidenceProgress: EvidenceProgressSnapshot;
  strategyHealth: IntegratedStrategyHealthSnapshot;
  confidenceCalibration: IntegratedConfidenceCalibrationSnapshot;
  tradeQuality: IntegratedTradeQualitySnapshot;
  microLiveReadiness: MicroLiveReadinessSnapshot;
  openPositionCount: number;
  dailyPnlUsd?: number;
  equityUsd?: number;
  overconfidenceWarning?: string | null;
}): { recommendation: RiskBudgetRecommendation; analysis: RiskBudgetAnalysis } {
  const configuredMax = input.configuredMaxNotional;
  const trustCap = input.trustNotionalUsd;
  const currentDaily = input.currentDailyLossLimitPct ?? Math.abs(
    VALIDATION_THRESHOLDS.dailyLossLimitPct,
  );
  const currentMaxOpen = input.currentMaxOpenPositions ?? DEFAULT_MAX_OPEN;

  const calReport = input.confidenceCalibration.report;
  const calMult = Math.min(1, calReport.recommendedSizeMultiplier);
  const primary = input.strategyHealth.primaryReport;
  const strategyStatus = primary?.status ?? null;
  const avgQuality = input.tradeQuality.summary.avgCompositeScore || null;
  const evidenceReady = input.evidenceProgress.evidenceSetReady;

  const dailyPnlPct =
    input.equityUsd && input.equityUsd > 0 && input.dailyPnlUsd != null
      ? (input.dailyPnlUsd / input.equityUsd) * 100
      : 0;
  const dailyPnlStressed =
    dailyPnlPct <= VALIDATION_THRESHOLDS.dailyLossLimitPct * 0.7;

  const reasons: string[] = [];
  let notionalMultiplier = 1;
  let riskPct = GOVERNANCE_MAX_RISK_PCT;
  let dailyLimit = -currentDaily;
  let maxOpen = currentMaxOpen;

  if (!evidenceReady) {
    notionalMultiplier *= 0.85;
    reasons.push(
      `Evidence ${input.evidenceProgress.completedTrades}/${input.evidenceProgress.requiredTrades} — conservative sizing until set complete.`,
    );
  }

  if (calReport.overconfidenceDetected) {
    notionalMultiplier *= calMult;
    riskPct *= calMult;
    reasons.push(
      input.overconfidenceWarning ?? calReport.confidenceAdjustmentRecommendation,
    );
  }

  if (strategyStatus === "REDUCE_RISK") {
    notionalMultiplier *= 0.75;
    riskPct *= 0.75;
    reasons.push(primary?.recommendation ?? "Strategy health REDUCE_RISK.");
  } else if (strategyStatus === "PAUSE" || strategyStatus === "REJECT") {
    notionalMultiplier *= 0.5;
    riskPct *= 0.5;
    maxOpen = 0;
    dailyLimit = Math.min(dailyLimit, -2);
    reasons.push(primary?.recommendation ?? `Strategy health ${strategyStatus}.`);
  }

  if (avgQuality != null && avgQuality < 55) {
    notionalMultiplier *= 0.8;
    riskPct *= 0.8;
    reasons.push(`Low avg trade quality (${avgQuality}/100) — reduce size.`);
  } else if (avgQuality != null && avgQuality >= 68) {
    reasons.push(`Trade quality supportive (${avgQuality}/100 avg).`);
  }

  if (input.microLiveReadiness.readinessStatus === "BLOCKED") {
    notionalMultiplier *= 0.7;
    reasons.push(
      input.microLiveReadiness.topBlocker ??
        "Micro-live readiness blocked — stay defensive on testnet.",
    );
  }

  if (dailyPnlStressed) {
    notionalMultiplier *= 0.6;
    maxOpen = Math.min(maxOpen, input.openPositionCount);
    dailyLimit = Math.min(dailyLimit, -2);
    reasons.push(`Daily PnL stressed (${round(dailyPnlPct)}%) — cooldown sizing.`);
  }

  const baseNotional = Math.min(configuredMax, trustCap);
  let recommendedMaxNotional = Math.floor(baseNotional * notionalMultiplier);
  recommendedMaxNotional = Math.max(
    BINANCE_MIN_NOTIONAL_USD,
    Math.min(recommendedMaxNotional, configuredMax),
  );

  let recommendedRiskPerTrade = round(
    Math.min(GOVERNANCE_MAX_RISK_PCT, riskPct * notionalMultiplier),
  );
  recommendedRiskPerTrade = Math.min(recommendedRiskPerTrade, GOVERNANCE_MAX_RISK_PCT);

  const mode = resolveMode({
    strategyStatus,
    overconfidence: calReport.overconfidenceDetected,
    evidenceReady,
    avgQuality,
    dailyPnlStressed,
    blocksNewEntries: input.strategyHealth.blocksNewTestnetEntries,
    readinessBlocked: input.microLiveReadiness.readinessStatus === "BLOCKED",
  });

  if (mode === "COOLDOWN") {
    maxOpen = Math.min(maxOpen, input.openPositionCount);
    if (maxOpen > 0 && strategyStatus !== "PAUSE" && strategyStatus !== "REJECT") {
      maxOpen = 1;
    }
  }

  if (reasons.length === 0) {
    reasons.push(
      "Risk budget within normal testnet parameters — approval required to change settings.",
    );
  }

  const analysis: RiskBudgetAnalysis = {
    evidenceCompletedTrades: input.evidenceProgress.completedTrades,
    evidenceRequired: input.evidenceProgress.requiredTrades,
    avgTradeQualityScore: avgQuality,
    confidenceSizeMultiplier: calMult,
    strategyHealthStatus: strategyStatus,
    overconfidenceDetected: calReport.overconfidenceDetected,
    governanceWarningRecommended:
      mode === "COOLDOWN" ||
      mode === "DEFENSIVE" ||
      recommendedMaxNotional < configuredMax * 0.85,
  };

  const recommendation: RiskBudgetRecommendation = {
    recommendationId: `irb-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    recommendedMaxNotional,
    recommendedRiskPerTrade,
    recommendedDailyLossLimit: round(dailyLimit),
    recommendedMaxOpenPositions: maxOpen,
    mode,
    reasons,
    requiresApproval: true,
    cannotIncreaseAutomatically: true,
    liveTradingLocked: true,
    currentMaxNotional: configuredMax,
    currentDailyLossLimitPct: currentDaily,
    currentMaxOpenPositions: currentMaxOpen,
  };

  return { recommendation, analysis };
}
