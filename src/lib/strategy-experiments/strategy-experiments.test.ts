import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { createStrategyExperiment, defaultVariant } from "./create-experiment";
import { experimentFromUserHypothesis } from "./create-from-sources";
import { runHistoricalReplay } from "./run-experiment";
import { applyPromotionPure } from "./apply-promotion";
import { buildExperimentLabReport } from "./build-report";

function tradeEntry(id: string, regime: string, pnl: number): DecisionLogEntry {
  return {
    id,
    timestamp: new Date().toISOString(),
    btcPrice: 65000,
    marketRegime: regime,
    agentOutputs: [
      {
        agentName: "Options Strategy Agent",
        strategyType: "OPTIONS",
        marketView: "test",
        recommendation: "TRADE",
        confidence: "MEDIUM",
        reasons: ["IV ok"],
        risks: [],
        proposedAction: "sell call",
        missingData: [],
      },
    ],
    finalVerdict: "TRADE",
    riskVeto: false,
    topReasons: ["trade"],
    actionPlan: "sell",
    outcomeStatus: "RESOLVED",
    paperPnl: pnl,
    reflection: null,
    resolution: {
      btcPriceAfter: 66000,
      tradeWouldWin: pnl > 0,
      notes: "test",
      resolvedAt: new Date().toISOString(),
    },
  };
}

describe("strategy-experiments", () => {
  it("creates isolated labeled experiment", () => {
    const exp = experimentFromUserHypothesis({
      summary: "Tighter macro filter",
      expectedOutcome: "Fewer losses",
    });
    assert.ok(exp.label.includes("[EXPERIMENT]"));
    assert.equal(exp.cannotPlaceLiveTrades, true);
    assert.equal(exp.isolatedFromProduction, true);
    assert.equal(exp.openPaperPositions, false);
  });

  it("runs historical replay with shadow trades", () => {
    const exp = createStrategyExperiment({
      source: "user_hypothesis",
      hypothesis: { summary: "Test", expectedOutcome: "Win" },
      variant: defaultVariant("options_short_premium"),
      mode: "strict_paper",
    });
    const entries = [
      tradeEntry("e1", "Risk-on trend", 2),
      tradeEntry("e2", "Risk-on trend", -1),
      tradeEntry("e3", "Risk-on trend", 3),
    ];
    const { experiment, shadowTrades, result } = runHistoricalReplay(exp, entries);
    assert.ok(shadowTrades.length >= 1);
    assert.ok(result.sampleSize >= 0);
    assert.ok(experiment.shadowTrades.length >= 1);
  });

  it("promotion requires approval before apply", () => {
    const exp = createStrategyExperiment({
      source: "user_hypothesis",
      hypothesis: { summary: "Promo test", expectedOutcome: "Up" },
      variant: defaultVariant(),
    });
    exp.result = {
      completedAt: new Date().toISOString(),
      sampleSize: 5,
      winRate: 60,
      netPnlPct: 3,
      shadowAccuracyPct: 55,
      tradeFrequencyDelta: 0,
      passedSuccess: true,
      passedFailure: false,
      summary: "Passed",
    };
    exp.promotionProposal = {
      proposalId: "promo-1",
      experimentId: exp.experimentId,
      targetStrategy: "options_short_premium",
      proposedRegistryStatus: "WATCHLIST",
      reason: "Test",
      supportingStats: { winRate: 60, netPnlPct: 3, sampleSize: 5, shadowAccuracyPct: 55 },
      humanApprovalRequired: true,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewerNote: null,
    };

    const approved = applyPromotionPure({
      experiment: exp,
      proposal: exp.promotionProposal,
      action: "approve",
    });
    assert.ok(approved);
    assert.equal(approved!.proposal.status, "APPROVED");

    const applied = applyPromotionPure({
      experiment: exp,
      proposal: approved!.proposal,
      action: "apply",
    });
    assert.ok(applied?.registryPatch);
    assert.equal(applied!.experiment.status, "promoted");
  });

  it("builds lab report with safety flags", () => {
    const report = buildExperimentLabReport([]);
    assert.equal(report.cannotPlaceLiveTrades, true);
    assert.equal(report.cannotChangeActiveWithoutApproval, true);
    assert.ok(report.safetyNotice.includes("isolated"));
  });
});
