import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildIntegratedQualityCalibration } from "./build-integrated-quality-calibration";
import {
  buildOverconfidenceWarning,
  buildStrategyImprovementSuggestion,
} from "./build-quality-calibration-outputs";
import type { IntegratedConfidenceCalibrationSnapshot } from "@/lib/integrated-confidence-calibration/types";
import type { IntegratedTradeQualitySnapshot, TradeQualityScore } from "@/lib/trade-quality-score/types";

function score(overrides: Partial<TradeQualityScore> = {}): TradeQualityScore {
  return {
    scoreId: "s1",
    tradeId: "t1",
    decisionLogId: "dl-1",
    generatedAt: new Date().toISOString(),
    source: "testnet_closed",
    grade: "C",
    compositeScore: 58,
    dimensions: {
      setupQuality: 60,
      marketRegimeFit: 45,
      entryQuality: 55,
      exitQuality: 62,
      riskReward: 50,
      ruleCompliance: 70,
      executionQuality: 58,
      reasoningConsistency: 52,
    },
    primaryReason: "Weakest: market regime fit",
    improvements: ["Align strategy with market regime — verify regime tag before entry."],
    improvementSuggestion: "Align strategy with market regime — verify regime tag before entry.",
    pnlPct: -0.5,
    tradeWouldWin: false,
    safetyNotice:
      "Trade quality scores are advisory — they grade decision process, not authorization to trade. Poor grades may reduce mission confidence but cannot enable live risk.",
    advisoryOnly: true,
    ...overrides,
  };
}

function tradeQualitySnapshot(scores: TradeQualityScore[]): IntegratedTradeQualitySnapshot {
  return {
    mvp: 76,
    label: "Integrated Trade Quality",
    summary: {
      sampleCount: scores.length,
      avgCompositeScore: scores[0]?.compositeScore ?? 0,
      avgGrade: "C",
      gradeCounts: { A: 0, B: 0, C: 1, D: 0, F: 0 },
      recent: scores,
      weakestDimension: "marketRegimeFit",
      headline: "test",
    },
    scoresByTradeId: Object.fromEntries(
      scores.filter((s) => s.tradeId).map((s) => [s.tradeId as string, s]),
    ),
    autoStrategyChangeAllowed: false,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function calibrationSnapshot(
  overconfident: boolean,
): IntegratedConfidenceCalibrationSnapshot {
  return {
    mvp: 77,
    label: "Calibration",
    report: {
      reportId: "r1",
      generatedAt: new Date().toISOString(),
      sampleCount: 5,
      bucketStats: [
        {
          bucketId: "70-79",
          label: "70–79%",
          min: 70,
          max: 79,
          sampleCount: 3,
          winRate: 40,
          avgConfidence: 74,
          avgPnlPct: -0.2,
          calibrationGap: 34,
          overconfident,
        },
      ],
      overconfidenceDetected: overconfident,
      underconfidenceDetected: false,
      confidenceAdjustmentRecommendation: "Reduce size",
      recommendedSizeMultiplier: 0.85,
      affectedAgents: [],
      affectedStrategies: [
        {
          strategyTag: "btc-short-premium",
          sampleCount: 3,
          avgStatedConfidence: 74,
          actualWinRate: 40,
          calibrationGap: 34,
          overconfident,
          underconfident: false,
          dominantRegime: "TREND_UP",
        },
      ],
      autoAgentWeightChangeAllowed: false,
      cannotIncreaseLiveRisk: true,
    },
    profile: null,
    agentScoreboardV2: {
      environment: "TESTNET",
      totalSamples: 5,
      rows: [],
      globalCalibrationGap: 34,
      updatedAt: new Date().toISOString(),
    },
    autoAgentWeightChangeAllowed: false,
    cannotIncreaseLiveRisk: true,
    lastUpdatedAt: new Date().toISOString(),
  };
}

describe("integrated quality calibration mvp90", () => {
  it("builds unified snapshot with eight dimensions", () => {
    const snapshot = buildIntegratedQualityCalibration({
      tradeQuality: tradeQualitySnapshot([score()]),
      confidenceCalibration: calibrationSnapshot(false),
    });
    assert.equal(snapshot.mvp, 90);
    assert.equal(snapshot.tradeQualityScore?.tradeId, "t1");
    assert.equal(snapshot.avgDimensionScores.marketRegimeFit, 45);
    assert.equal(snapshot.overconfidenceWarning, null);
  });

  it("derives overconfidence warning from calibration report", () => {
    const report = calibrationSnapshot(true).report;
    const warning = buildOverconfidenceWarning(report);
    assert.ok(warning?.includes("Overconfidence"));
    const suggestion = buildStrategyImprovementSuggestion({
      latestScore: score(),
      weakestDimension: "marketRegimeFit",
      report,
      strategyHealth: null,
    });
    assert.ok(suggestion?.includes("Market regime fit") || suggestion?.includes("btc-short-premium"));
  });
});
