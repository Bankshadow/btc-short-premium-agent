import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildIntegratedDailySelfReview } from "./build-daily-self-review";
import { emptyEvidenceProgress } from "@/lib/evidence-progress";
import { emptyLearningProgress } from "@/lib/learning-queue/empty-snapshot";
import { emptyIntegratedStrategyHealth } from "@/lib/integrated-strategy-health/empty-snapshot";
import { emptyIntegratedTradeQuality } from "@/lib/trade-quality-score/empty-snapshot";
import { emptyIntegratedConfidenceCalibration } from "@/lib/integrated-confidence-calibration/empty-snapshot";
import { emptyIntegratedRiskBudget } from "@/lib/integrated-risk-budget/empty-snapshot";

const baseExecutionQuality = {
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
  liveQualityGate: { status: "PASS" as const, reasons: [], blocksLiveReadiness: false },
};

describe("Integrated daily self-review (MVP 79)", () => {
  it("marks review advisory-only with live locked", () => {
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
      executionQuality: baseExecutionQuality,
      monitorEvents: [],
      incidents: [],
      dailyPnlUsd: 0,
    });

    assert.equal(review.advisoryOnly, true);
    assert.equal(review.liveTradingLocked, true);
    assert.equal(review.requiresApproval, true);
    assert.ok(review.suggestedCursorTask.includes("MVP 79"));
  });

  it("surfaces loss as worst decision and links learning records", () => {
    const today = new Date().toISOString();
    const review = buildIntegratedDailySelfReview({
      evidenceProgress: emptyEvidenceProgress(),
      closedTrades: [
        {
          id: "t1",
          exchange: "BINANCE",
          symbol: "BTCUSDT",
          side: "SHORT",
          entryPrice: 70000,
          exitPrice: 71000,
          qty: "0.01",
          grossPnl: -10,
          fee: 1,
          netPnl: -11,
          rMultiple: -1,
          result: "LOSS",
          durationMs: 3600000,
          decisionLogId: "dl-1",
          strategy: "core",
          aiVerdict: "TRADE",
          confidence: 0.7,
          openedAt: today,
          closedAt: today,
          notes: "Stop hit",
          learned: false,
          previewId: null,
        },
      ],
      decisions: [],
      learningRecords: [
        {
          learningRecordId: "lr-1",
          environment: "TESTNET",
          tradeId: "t1",
          symbol: "BTCUSDT",
          side: "SHORT",
          decisionLogId: "dl-1",
          previewId: null,
          orderId: null,
          positionId: null,
          closedTradeId: "t1",
          strategy: "core",
          strategyTag: "core",
          sourceAgent: null,
          finalVerdict: "TRADE",
          aiVerdict: "TRADE",
          confidence: 0.7,
          entryReason: "Edge",
          closeReason: "Stop",
          whatWorked: null,
          whatFailed: "Entered too early",
          suggestedAdjustment: null,
          grossPnl: -10,
          netPnl: -11,
          fee: 1,
          rMultiple: -1,
          maxFavorableExcursion: 0,
          maxAdverseExcursion: 0,
          durationMs: 3600000,
          result: "LOSS",
          includeInLearning: true,
          status: "PENDING_REVIEW",
          reflectionNotes: null,
          qualityGrade: "D",
          qualityScore: 45,
          qualityScoreId: null,
          createdAt: today,
          updatedAt: today,
        },
      ],
      learningProgress: emptyLearningProgress(),
      strategyHealth: emptyIntegratedStrategyHealth(),
      tradeQuality: emptyIntegratedTradeQuality(),
      confidenceCalibration: emptyIntegratedConfidenceCalibration(),
      riskBudget: emptyIntegratedRiskBudget(),
      executionQuality: baseExecutionQuality,
      monitorEvents: [],
      incidents: [],
      dailyPnlUsd: -11,
    });

    assert.equal(review.tradesToday, 1);
    assert.equal(review.pnlToday, -11);
    assert.ok(review.worstDecision.includes("Loss"));
    assert.deepEqual(review.linkedLearningRecordIds, ["lr-1"]);
    assert.ok(review.lessonsLearned.some((l) => l.includes("Entered too early")));
  });
});
