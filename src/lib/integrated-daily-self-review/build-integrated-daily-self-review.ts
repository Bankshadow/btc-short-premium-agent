import type { AnomalyIncident } from "@/lib/anomaly-detection/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { IntegratedConfidenceCalibrationSnapshot } from "@/lib/integrated-confidence-calibration/types";
import type { IntegratedRiskBudgetSnapshot } from "@/lib/integrated-risk-budget/types";
import type { IntegratedStrategyHealthSnapshot } from "@/lib/integrated-strategy-health/types";
import type { EvidenceProgressSnapshot } from "@/lib/evidence-progress/types";
import type { ExecutionQualitySummary } from "@/lib/execution-quality/types";
import type { LearningProgressSnapshot } from "@/lib/learning-queue/types";
import type { IntegratedTradeQualitySnapshot } from "@/lib/trade-quality-score/types";
import type {
  TestnetClosedTrade,
  TestnetLearningRecord,
  TestnetMonitorJournalEvent,
} from "@/lib/testnet-monitor/types";
import { buildIntegratedDailySelfReview } from "./build-daily-self-review";
import { setCachedDailySelfReview } from "./daily-self-review-cache";
import { persistDailySelfReviewCreatedSideEffects } from "./persist-daily-self-review-event";
import type { IntegratedDailySelfReviewSnapshot } from "./types";
import {
  INTEGRATED_DAILY_SELF_REVIEW_LABEL,
  INTEGRATED_DAILY_SELF_REVIEW_MVP,
  INTEGRATED_DAILY_SELF_REVIEW_SAFETY_NOTICE,
} from "./types";

export { buildIntegratedDailySelfReview } from "./build-daily-self-review";

export async function buildIntegratedDailySelfReviewSnapshot(input: {
  evidenceProgress: EvidenceProgressSnapshot;
  closedTrades: TestnetClosedTrade[];
  decisions: DecisionLogEntry[];
  learningRecords: TestnetLearningRecord[];
  learningProgress: LearningProgressSnapshot;
  strategyHealth: IntegratedStrategyHealthSnapshot;
  tradeQuality: IntegratedTradeQualitySnapshot;
  confidenceCalibration: IntegratedConfidenceCalibrationSnapshot;
  riskBudget: IntegratedRiskBudgetSnapshot;
  executionQuality: ExecutionQualitySummary;
  monitorEvents: TestnetMonitorJournalEvent[];
  incidents: AnomalyIncident[];
  dailyPnlUsd: number;
  persistSideEffects?: boolean;
}): Promise<IntegratedDailySelfReviewSnapshot> {
  const review = buildIntegratedDailySelfReview({
    evidenceProgress: input.evidenceProgress,
    closedTrades: input.closedTrades,
    decisions: input.decisions,
    learningRecords: input.learningRecords,
    learningProgress: input.learningProgress,
    strategyHealth: input.strategyHealth,
    tradeQuality: input.tradeQuality,
    confidenceCalibration: input.confidenceCalibration,
    riskBudget: input.riskBudget,
    executionQuality: input.executionQuality,
    monitorEvents: input.monitorEvents,
    incidents: input.incidents,
    dailyPnlUsd: input.dailyPnlUsd,
  });

  setCachedDailySelfReview(review);

  if (input.persistSideEffects) {
    await persistDailySelfReviewCreatedSideEffects({ review });
  }

  return {
    mvp: INTEGRATED_DAILY_SELF_REVIEW_MVP,
    label: INTEGRATED_DAILY_SELF_REVIEW_LABEL,
    review,
    autoStrategyChangeAllowed: false,
    safetyNotice: INTEGRATED_DAILY_SELF_REVIEW_SAFETY_NOTICE,
    lastUpdatedAt: new Date().toISOString(),
  };
}
