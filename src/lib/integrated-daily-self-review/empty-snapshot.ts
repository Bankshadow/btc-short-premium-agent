import { emptyEvidenceProgress } from "@/lib/evidence-progress";

import { emptyLearningProgress } from "@/lib/learning-queue/empty-snapshot";

import { emptyIntegratedConfidenceCalibration } from "@/lib/integrated-confidence-calibration/empty-snapshot";

import { emptyIntegratedStrategyHealth } from "@/lib/integrated-strategy-health/empty-snapshot";

import { emptyIntegratedRiskBudget } from "@/lib/integrated-risk-budget/empty-snapshot";

import { emptyIntegratedTradeQuality } from "@/lib/trade-quality-score/empty-snapshot";

import { buildIntegratedDailySelfReview } from "./build-daily-self-review";

import type { IntegratedDailySelfReviewSnapshot } from "./types";

import {

  INTEGRATED_DAILY_SELF_REVIEW_LABEL,

  INTEGRATED_DAILY_SELF_REVIEW_MVP,

  INTEGRATED_DAILY_SELF_REVIEW_SAFETY_NOTICE,

} from "./types";



/** Client-safe empty snapshot — no fs. */

export function emptyIntegratedDailySelfReview(): IntegratedDailySelfReviewSnapshot {

  const review = buildIntegratedDailySelfReview({

    evidenceProgress: emptyEvidenceProgress(),

    closedTrades: [],

    decisions: [],

    learningRecords: [],

    learningProgress: emptyLearningProgress(),

    strategyHealth: emptyIntegratedStrategyHealth(),

    tradeQuality: emptyIntegratedTradeQuality(),

    confidenceCalibration: emptyIntegratedConfidenceCalibration(),

    riskBudget: emptyIntegratedRiskBudget(),

    executionQuality: {

      generatedAt: new Date().toISOString(),

      averageSlippageBps: 0,

      averageLatencyMs: 0,

      rejectionRatePct: 0,

      failedCloseRatePct: 0,

      partialFillRatePct: 0,

      duplicateSubmissionCount: 0,

      retryCountTotal: 0,

      feeImpactUsd: 0,

      failedOrderCount: 0,

      closeFailureCount: 0,

      slippageBySymbol: [],

      latencyTrend: [],

      exchangeErrors: [],

      byStrategy: [],

      liveQualityGate: { status: "PASS", reasons: [], blocksLiveReadiness: false },

      safetyNotice:
        "Execution Quality Monitor is read-only telemetry. It cannot submit, close, or modify orders.",

    },

    monitorEvents: [],

    incidents: [],

    dailyPnlUsd: 0,

  });



  return {

    mvp: INTEGRATED_DAILY_SELF_REVIEW_MVP,

    label: INTEGRATED_DAILY_SELF_REVIEW_LABEL,

    review,

    autoStrategyChangeAllowed: false,

    safetyNotice: INTEGRATED_DAILY_SELF_REVIEW_SAFETY_NOTICE,

    lastUpdatedAt: new Date().toISOString(),

  };

}


