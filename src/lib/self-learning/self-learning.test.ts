import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { evaluateClosedTrade } from "./evaluate-entry";
import { buildLearningEvaluationReport } from "./build-learning-report";
import { aggregateAgentLeaderboard } from "./aggregate-agents";

function sampleEntry(overrides: Partial<DecisionLogEntry> = {}): DecisionLogEntry {
  return {
    id: "log-learn-1",
    timestamp: new Date().toISOString(),
    btcPrice: 65000,
    marketRegime: "Risk-on trend",
    agentOutputs: [
      {
        agentName: "Bull Thesis Agent",
        strategyType: "THESIS",
        marketView: "bull",
        recommendation: "TRADE",
        confidence: "HIGH",
        reasons: ["Momentum"],
        risks: ["Macro"],
        proposedAction: "long",
        missingData: [],
      },
      {
        agentName: "Options Strategy Agent",
        strategyType: "OPTIONS",
        marketView: "options",
        recommendation: "SKIP",
        confidence: "MEDIUM",
        reasons: ["IV low"],
        risks: ["Gamma"],
        proposedAction: "none",
        missingData: [],
      },
      {
        agentName: "Risk Manager Agent",
        strategyType: "RISK",
        marketView: "risk",
        recommendation: "SKIP",
        confidence: "HIGH",
        reasons: ["Veto"],
        risks: ["Drawdown"],
        proposedAction: "none",
        missingData: [],
        veto: true,
        vetoReasons: ["Daily loss"],
      },
      {
        agentName: "Data Quality Agent",
        strategyType: "RESEARCH",
        marketView: "data",
        recommendation: "WAIT",
        confidence: "MEDIUM",
        reasons: ["Partial tape"],
        risks: [],
        proposedAction: "none",
        missingData: ["HV30"],
      },
    ],
    finalVerdict: "SKIP",
    riskVeto: true,
    topReasons: ["Risk veto"],
    actionPlan: "No trade",
    outcomeStatus: "RESOLVED",
    paperPnl: -2.5,
    reflection: {
      generatedAt: new Date().toISOString(),
      whatWasCorrect: ["Risk veto"],
      whatWasWrong: ["Bull too aggressive"],
      tooAggressiveAgents: ["Bull Thesis Agent"],
      helpfulRiskRules: ["Daily loss cap"],
      suggestedDraftRule: "Respect risk veto in risk-on",
    },
    resolution: {
      btcPriceAfter: 64000,
      tradeWouldWin: false,
      notes: "Loss",
      resolvedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("self-learning", () => {
  it("evaluates closed trade for core agents", () => {
    const result = evaluateClosedTrade({
      entry: sampleEntry(),
      source: "paper_close",
    });
    assert.ok(result);
    assert.equal(result.advisoryOnly, undefined);
    assert.ok(result.agentEvaluations.length >= 2);
    assert.equal(result.committeeEvaluation.agentName, "Investment Committee");
    assert.ok(result.improvementHints.length > 0);
  });

  it("aggregates leaderboard across evaluations", () => {
    const r1 = evaluateClosedTrade({
      entry: sampleEntry(),
      source: "paper_close",
    })!;
    const r2 = evaluateClosedTrade({
      entry: sampleEntry({
        id: "log-learn-2",
        paperPnl: 3,
        resolution: {
          btcPriceAfter: 66000,
          tradeWouldWin: true,
          notes: "Win",
          resolvedAt: new Date().toISOString(),
        },
      }),
      source: "manual_resolve",
    })!;
    const board = aggregateAgentLeaderboard([r1, r2]);
    const bull = board.find((a) => a.agentName === "Bull Thesis Agent");
    assert.ok(bull);
    assert.equal(bull.prediction.totalCalls, 2);
  });

  it("builds learning report with safety flags", () => {
    const entry = sampleEntry();
    const result = evaluateClosedTrade({ entry, source: "paper_close" })!;
    const report = buildLearningEvaluationReport({
      entries: [entry],
      storedResults: [result],
    });
    assert.equal(report.cannotAutoChangeLive, true);
    assert.equal(report.proposalsOnly, true);
    assert.ok(report.safetyNotice.includes("advisory"));
    assert.ok(report.agentLeaderboard.length > 0);
    assert.ok(report.improvementRecommendations.length > 0);
  });
});
