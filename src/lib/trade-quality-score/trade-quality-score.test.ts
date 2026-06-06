import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTradeQualitySummary } from "./build-summary";
import { buildTradeQualityScore } from "./score-trade";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";

function resolvedEntry(overrides: Partial<DecisionLogEntry> = {}): DecisionLogEntry {
  return {
    id: "log-1",
    timestamp: new Date().toISOString(),
    btcPrice: 65000,
    marketRegime: "TREND_UP",
    agentOutputs: [],
    finalVerdict: "TRADE",
    riskVeto: false,
    topReasons: ["Strong setup", "Risk ok"],
    actionPlan: "Enter",
    outcomeStatus: "RESOLVED",
    paperPnl: 2.5,
    reflection: {
      whatWasCorrect: ["Timing"],
      whatWasWrong: [],
      tooAggressiveAgents: [],
      helpfulRiskRules: ["Daily loss guard"],
      suggestedDraftRule: "",
      generatedAt: new Date().toISOString(),
    },
    resolution: {
      btcPriceAfter: 66000,
      tradeWouldWin: true,
      outcomeLabel: "WIN",
      notes: "Good trade",
      resolvedAt: new Date().toISOString(),
    },
    preMortem: {
      preMortemId: "pm-1",
      failureScenarios: [],
      topFailureReason: "",
      riskAmplifiers: [],
      invalidationTriggers: [],
      mitigationPlan: [],
      preMortemVerdict: "PASS",
      confidence: "HIGH",
      generatedAt: new Date().toISOString(),
    },
    playbookConfidence: 78,
    ...overrides,
  };
}

describe("Trade quality score (MVP 84)", () => {
  it("grades high-quality winning process as A or B", () => {
    const score = buildTradeQualityScore({
      entry: resolvedEntry(),
      pnlPct: 2.5,
      tradeWouldWin: true,
    });
    assert.ok(["A", "B"].includes(score.grade));
    assert.ok(score.compositeScore >= 68);
    assert.ok(score.improvements.length >= 0);
    assert.ok(score.primaryReason.includes("Grade"));
  });

  it("grades poor false-positive trades lower than strong process wins", () => {
    const good = buildTradeQualityScore({
      entry: resolvedEntry(),
      pnlPct: 1,
      tradeWouldWin: true,
    });
    const bad = buildTradeQualityScore({
      entry: resolvedEntry({
        falseTradeFlag: true,
        finalVerdict: "TRADE",
        paperPnl: -4,
        resolution: {
          btcPriceAfter: 64000,
          tradeWouldWin: false,
          outcomeLabel: "LOSS",
          notes: "Bad entry",
          resolvedAt: new Date().toISOString(),
        },
        reflection: null,
        preMortem: undefined,
      }),
      pnlPct: -4,
      tradeWouldWin: false,
    });
    assert.ok(good.compositeScore > bad.compositeScore);
    assert.ok(["C", "D", "F"].includes(bad.grade));
  });

  it("summarizes recent trade quality grades", () => {
    const scores = [
      buildTradeQualityScore({ entry: resolvedEntry({ id: "a" }), pnlPct: 2, tradeWouldWin: true }),
      buildTradeQualityScore({
        entry: resolvedEntry({ id: "b", paperPnl: -2, resolution: { btcPriceAfter: 1, tradeWouldWin: false, notes: "", resolvedAt: new Date().toISOString() } }),
        pnlPct: -2,
        tradeWouldWin: false,
      }),
    ];
    const summary = buildTradeQualitySummary(scores);
    assert.equal(summary.sampleCount, 2);
    assert.ok(summary.avgCompositeScore > 0);
    assert.ok(summary.recent.length === 2);
  });
});
