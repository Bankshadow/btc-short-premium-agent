import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyEvidenceProgress } from "@/lib/evidence-progress";
import { emptyIntegratedConfidenceCalibration } from "@/lib/integrated-confidence-calibration/empty-snapshot";
import { emptyIntegratedStrategyHealth } from "@/lib/integrated-strategy-health/empty-snapshot";
import { emptyMicroLiveReadiness } from "@/lib/micro-live-readiness/empty-snapshot";
import { emptyIntegratedTradeQuality } from "@/lib/trade-quality-score/empty-snapshot";
import { buildRiskBudgetRecommendation } from "./build-risk-budget-recommendation";

describe("Integrated risk budget (MVP 78)", () => {
  it("never recommends notional above configured cap", () => {
    const { recommendation } = buildRiskBudgetRecommendation({
      configuredMaxNotional: 55,
      trustNotionalUsd: 55,
      evidenceProgress: {
        ...emptyEvidenceProgress(),
        evidenceSetReady: true,
        completedTrades: 12,
      },
      strategyHealth: emptyIntegratedStrategyHealth(),
      confidenceCalibration: emptyIntegratedConfidenceCalibration(),
      tradeQuality: emptyIntegratedTradeQuality(),
      microLiveReadiness: emptyMicroLiveReadiness(),
      openPositionCount: 0,
    });
    assert.ok(recommendation.recommendedMaxNotional <= 55);
    assert.equal(recommendation.requiresApproval, true);
    assert.equal(recommendation.cannotIncreaseAutomatically, true);
    assert.equal(recommendation.liveTradingLocked, true);
  });

  it("recommends defensive mode when strategy health is REDUCE_RISK", () => {
    const health = emptyIntegratedStrategyHealth();
    health.primaryReport = {
      reportId: "r1",
      strategyTag: "AUTO_TESTNET",
      status: "REDUCE_RISK",
      evidenceCount: 12,
      winRate: 50,
      profitFactor: 1,
      maxDrawdown: 5,
      avgWin: 10,
      avgLoss: 8,
      biggestWeakness: null,
      bestPattern: null,
      recommendation: "Reduce size.",
      nextAction: "Review.",
      linkedDecisionIds: [],
      linkedTradeIds: [],
      linkedLearningRecordIds: [],
      avgTradeQualityScore: 60,
      riskVetoRate: 0,
      agentTradeAgreementRate: 0.5,
      confidenceCalibrationGap: null,
      confidenceOverconfident: false,
      netPnl: 5,
      reviewedAt: new Date().toISOString(),
    };
    const { recommendation } = buildRiskBudgetRecommendation({
      configuredMaxNotional: 55,
      trustNotionalUsd: 55,
      evidenceProgress: {
        ...emptyEvidenceProgress(),
        evidenceSetReady: true,
        completedTrades: 12,
      },
      strategyHealth: health,
      confidenceCalibration: emptyIntegratedConfidenceCalibration(),
      tradeQuality: emptyIntegratedTradeQuality(),
      microLiveReadiness: emptyMicroLiveReadiness(),
      openPositionCount: 0,
    });
    assert.ok(["DEFENSIVE", "COOLDOWN"].includes(recommendation.mode));
    assert.ok(recommendation.recommendedMaxNotional < 55);
    assert.ok(recommendation.reasons.length > 0);
  });
});
