import { loadBinanceConfig } from "@/lib/exchange/binance/binance-config";
import { resolveTrustScaledNotionalUsd } from "@/lib/exchange/binance/trust-scaled-notional";
import type { IntegratedConfidenceCalibrationSnapshot } from "@/lib/integrated-confidence-calibration/types";
import type { IntegratedStrategyHealthSnapshot } from "@/lib/integrated-strategy-health/types";
import type { MicroLiveReadinessSnapshot } from "@/lib/micro-live-readiness/types";
import type { EvidenceProgressSnapshot } from "@/lib/evidence-progress/types";
import type { IntegratedTradeQualitySnapshot } from "@/lib/trade-quality-score/types";
import type { IntegratedQualityCalibrationSnapshot } from "@/lib/integrated-quality-calibration/types";
import { buildRiskBudgetRecommendation } from "./build-risk-budget-recommendation";
import { setCachedRiskBudgetRecommendation } from "./risk-budget-cache";
import { persistRiskBudgetRecommendedSideEffects } from "./persist-risk-budget-event";
import type { IntegratedRiskBudgetSnapshot } from "./types";
import {
  INTEGRATED_RISK_BUDGET_LABEL,
  INTEGRATED_RISK_BUDGET_MVP,
  RISK_BUDGET_SAFETY_NOTICE,
} from "./types";

export { buildRiskBudgetRecommendation } from "./build-risk-budget-recommendation";

export async function buildIntegratedRiskBudget(input: {
  evidenceProgress: EvidenceProgressSnapshot;
  strategyHealth: IntegratedStrategyHealthSnapshot;
  confidenceCalibration: IntegratedConfidenceCalibrationSnapshot;
  tradeQuality: IntegratedTradeQualitySnapshot;
  microLiveReadiness: MicroLiveReadinessSnapshot;
  openPositionCount: number;
  dailyPnlUsd?: number;
  equityUsd?: number;
  persistSideEffects?: boolean;
  qualityCalibration?: IntegratedQualityCalibrationSnapshot | null;
}): Promise<IntegratedRiskBudgetSnapshot> {
  const config = loadBinanceConfig();
  const trustNotionalUsd = resolveTrustScaledNotionalUsd({
    completedTrades: input.evidenceProgress.completedTrades,
    minRequired: input.evidenceProgress.requiredTrades,
    maxNotionalUsd: config.maxNotionalUsd,
  });

  const { recommendation, analysis } = buildRiskBudgetRecommendation({
    configuredMaxNotional: config.maxNotionalUsd,
    trustNotionalUsd,
    evidenceProgress: input.evidenceProgress,
    strategyHealth: input.strategyHealth,
    confidenceCalibration: input.confidenceCalibration,
    tradeQuality: input.tradeQuality,
    microLiveReadiness: input.microLiveReadiness,
    openPositionCount: input.openPositionCount,
    dailyPnlUsd: input.dailyPnlUsd,
    equityUsd: input.equityUsd,
    overconfidenceWarning: input.qualityCalibration?.overconfidenceWarning ?? null,
  });

  setCachedRiskBudgetRecommendation(recommendation);

  if (input.persistSideEffects) {
    await persistRiskBudgetRecommendedSideEffects({
      recommendation,
      analysis,
    });
  }

  return {
    mvp: INTEGRATED_RISK_BUDGET_MVP,
    label: INTEGRATED_RISK_BUDGET_LABEL,
    recommendation,
    analysis,
    autoApplyAllowed: false,
    safetyNotice: RISK_BUDGET_SAFETY_NOTICE,
    lastUpdatedAt: new Date().toISOString(),
  };
}
