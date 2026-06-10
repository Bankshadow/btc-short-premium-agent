import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentOutput } from "@/lib/agents/types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { buildEnrichedAgentScoreboardV2 } from "./build-agent-scoreboard-v2-enriched";
import { buildIntegratedStrategyAgentHealth } from "./build-integrated-strategy-agent-health";
import type { ConfidenceCalibrationReport } from "@/lib/integrated-confidence-calibration/types";
import type { IntegratedStrategyHealthSnapshot } from "@/lib/integrated-strategy-health/types";
import type { TradeQualityScore } from "@/lib/trade-quality-score/types";

function agent(name: string, rec: "TRADE" | "SKIP", veto = false): AgentOutput {
  return {
    agentName: name,
    recommendation: rec,
    strategyType: "FUTURES",
    confidence: "HIGH",
    marketView: "test",
    reasons: ["r1"],
    risks: [],
    proposedAction: "act",
    missingData: [],
    veto: veto || undefined,
  };
}

function journal(netPnl: number, decisionLogId: string): BinanceTestnetJournalEntry {
  return {
    binanceTestnetTradeId: `t-${netPnl}`,
    symbol: "BTCUSDT",
    side: "SELL",
    quantity: "0.01",
    status: "CLOSED",
    decisionLogId,
    realizedPnl: netPnl,
    notionalUsd: 500,
    createdAt: "2026-01-01T00:00:00.000Z",
    closedAt: "2026-01-01T01:00:00.000Z",
  } as BinanceTestnetJournalEntry;
}

function decision(id: string, agents: AgentOutput[]): DecisionLogEntry {
  return {
    id,
    timestamp: "2026-01-01T00:00:00.000Z",
    btcPrice: 65000,
    marketRegime: "TREND_UP",
    agentOutputs: agents,
    finalVerdict: "TRADE",
    riskVeto: agents.some((a) => a.veto),
    topReasons: ["setup"],
    actionPlan: "enter",
    outcomeStatus: "RESOLVED",
    paperPnl: null,
  } as DecisionLogEntry;
}

function emptyCalibration(): ConfidenceCalibrationReport {
  return {
    reportId: "r0",
    generatedAt: new Date().toISOString(),
    sampleCount: 0,
    bucketStats: [],
    overconfidenceDetected: false,
    underconfidenceDetected: false,
    confidenceAdjustmentRecommendation: "ok",
    recommendedSizeMultiplier: 1,
    affectedAgents: [],
    affectedStrategies: [],
    autoAgentWeightChangeAllowed: false,
    cannotIncreaseLiveRisk: true,
  };
}

function strategyHealth(): IntegratedStrategyHealthSnapshot {
  return {
    mvp: 74,
    label: "Integrated Strategy Health After 12 Trades",
    evidenceRequired: 12,
    evidenceReady: false,
    primaryReport: null,
    reportsByTag: [],
    registryRecommendation: null,
    agentScoreboardLearned: 0,
    governanceWarningActive: false,
    blocksNewTestnetEntries: false,
    autoStrategyChangeAllowed: false,
    liveTradingBlocked: true,
    confidenceOverconfidenceDetected: false,
    confidenceAdjustmentRecommendation: null,
    evidenceQualityBlocked: false,
    evidenceQualityBlockReason: null,
    lastUpdatedAt: new Date().toISOString(),
  };
}

describe("integrated strategy agent health mvp91", () => {
  it("scores agent prediction accuracy and false positive rate", () => {
    const d1 = decision("dl-1", [
      agent("Momentum Agent", "TRADE"),
      agent("Risk Manager Agent", "SKIP", true),
    ]);
    const d2 = decision("dl-2", [agent("Momentum Agent", "TRADE")]);

    const score: TradeQualityScore = {
      scoreId: "qs-1",
      tradeId: "t-10",
      decisionLogId: "dl-1",
      generatedAt: new Date().toISOString(),
      source: "testnet_closed",
      grade: "B",
      compositeScore: 72,
      dimensions: {
        setupQuality: 70,
        marketRegimeFit: 68,
        entryQuality: 72,
        exitQuality: 70,
        riskReward: 65,
        ruleCompliance: 80,
        executionQuality: 74,
        reasoningConsistency: 71,
      },
      primaryReason: "ok",
      improvements: [],
      pnlPct: 1,
      tradeWouldWin: true,
      safetyNotice:
        "Trade quality scores are advisory — they grade decision process, not authorization to trade. Poor grades may reduce mission confidence but cannot enable live risk.",
      advisoryOnly: true,
    };

    const board = buildEnrichedAgentScoreboardV2({
      journal: [journal(10, "dl-1"), journal(-5, "dl-2")],
      closedTrades: [],
      learningRecords: [],
      decisions: [d1, d2],
      tradeQualityScores: [score],
      calibrationReport: emptyCalibration(),
    });

    const momentum = board.rows.find((r) => r.sourceAgent === "Momentum Agent");
    assert.ok(momentum);
    assert.equal(momentum!.sampleCount, 2);
    assert.equal(momentum!.predictionAccuracyPct, 50);
    assert.equal(momentum!.falsePositives, 1);
    assert.equal(momentum!.falsePositiveRate, 50);
    assert.equal(momentum!.alignedTradeQuality, 72);
  });

  it("builds integrated snapshot with human approval required", () => {
    const snapshot = buildIntegratedStrategyAgentHealth({
      journal: [journal(8, "dl-1")],
      closedTrades: [],
      learningRecords: [],
      decisions: [decision("dl-1", [agent("Momentum Agent", "TRADE")])],
      tradeQualityScores: [],
      strategyHealth: strategyHealth(),
      confidenceCalibrationReport: emptyCalibration(),
    });
    assert.equal(snapshot.mvp, 91);
    assert.equal(snapshot.humanApprovalRequired, true);
    assert.equal(snapshot.autoStrategyChangeAllowed, false);
    assert.equal(snapshot.cannotIncreaseLiveRisk, true);
  });
});
