import { emptyEvidenceProgress } from "@/lib/evidence-progress";
import { emptyIntegratedConfidenceCalibration } from "@/lib/integrated-confidence-calibration/empty-snapshot";
import { emptyIntegratedStrategyHealth } from "@/lib/integrated-strategy-health/empty-snapshot";
import { emptyMicroLiveReadiness } from "@/lib/micro-live-readiness/empty-snapshot";
import { emptyIntegratedTradeQuality } from "@/lib/trade-quality-score/empty-snapshot";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import { buildRiskBudgetRecommendation } from "./build-risk-budget-recommendation";
import type { IntegratedRiskBudgetSnapshot } from "./types";
import {
  INTEGRATED_RISK_BUDGET_LABEL,
  INTEGRATED_RISK_BUDGET_MVP,
  RISK_BUDGET_SAFETY_NOTICE,
} from "./types";

const DEFAULT_MAX_NOTIONAL = 55;

/** Client-safe empty snapshot — no fs. */
export function emptyIntegratedRiskBudget(): IntegratedRiskBudgetSnapshot {
  const { recommendation, analysis } = buildRiskBudgetRecommendation({
    configuredMaxNotional: DEFAULT_MAX_NOTIONAL,
    trustNotionalUsd: DEFAULT_MAX_NOTIONAL,
    evidenceProgress: emptyEvidenceProgress(),
    strategyHealth: emptyIntegratedStrategyHealth(),
    confidenceCalibration: emptyIntegratedConfidenceCalibration(),
    tradeQuality: emptyIntegratedTradeQuality(),
    microLiveReadiness: emptyMicroLiveReadiness(),
    openPositionCount: 0,
    currentDailyLossLimitPct: Math.abs(VALIDATION_THRESHOLDS.dailyLossLimitPct),
  });

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
