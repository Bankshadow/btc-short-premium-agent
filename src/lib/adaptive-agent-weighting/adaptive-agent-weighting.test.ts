import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentOutput } from "@/lib/agents/types";
import type { AgentEvaluation } from "@/lib/self-learning/types";
import { applyHardConstraints } from "./apply-hard-constraints";
import { computeWeightedCommitteeVerdict } from "./compute-weighted-verdict";
import { DEFAULT_ADAPTIVE_WEIGHTING_SETTINGS } from "./types";

function agent(
  name: string,
  recommendation: AgentOutput["recommendation"],
  confidence: AgentOutput["confidence"] = "HIGH",
): AgentOutput {
  return {
    agentName: name,
    recommendation,
    strategyType: "THESIS",
    confidence,
    marketView: "view",
    reasons: ["r"],
    risks: [],
    proposedAction: "act",
    missingData: [],
  };
}

function evalEntry(
  name: string,
  hitRate: number,
  overrides: Partial<AgentEvaluation["prediction"]> = {},
): AgentEvaluation {
  return {
    agentName: name,
    prediction: {
      hitRate,
      avgPnlAfterTradeRec: 0,
      avoidedLossAfterSkip: 0,
      opportunityCostWrongSkip: 0,
      lossFromWrongTrade: 0,
      falsePositives: 0,
      falseNegatives: 0,
      correctTradeCalls: 0,
      correctSkips: 0,
      totalCalls: 10,
      ...overrides,
    },
    reasoning: {
      riskWarningUsefulness: 70,
      missedRiskFactors: [],
      reasoningQuality: 70,
      confidenceCalibrationError: 0.1,
      regretScore: 0,
    },
    contributionToVerdict: 0,
    byRegime: [{ label: "Risk-on trend", hitRate: 80, sampleSize: 5, avgPnlPct: 1 }],
    byAsset: [{ label: "BTCUSDT", hitRate: 75, sampleSize: 5, avgPnlPct: 1 }],
    byStrategy: [
      { label: "options_short_premium", hitRate: 78, sampleSize: 5, avgPnlPct: 1 },
    ],
    overallGrade: "B",
    helpingScore: 70,
  };
}

const enabledSettings = {
  ...DEFAULT_ADAPTIVE_WEIGHTING_SETTINGS,
  adaptiveWeightingEnabled: true,
  minClosedTradesBeforeWeighting: 3,
};

describe("adaptive-agent-weighting", () => {
  it("returns null when disabled", () => {
    const result = computeWeightedCommitteeVerdict({
      settings: DEFAULT_ADAPTIVE_WEIGHTING_SETTINGS,
      marketRegime: "Risk-on trend",
      riskProfile: "balanced",
      agents: [agent("Bull Thesis Agent", "TRADE")],
      originalVerdict: "SKIP",
      totalResolvedTrades: 10,
      riskVeto: false,
    });
    assert.equal(result, null);
  });

  it("returns null when insufficient closed trades", () => {
    const result = computeWeightedCommitteeVerdict({
      settings: enabledSettings,
      marketRegime: "Risk-on trend",
      riskProfile: "balanced",
      agents: [agent("Bull Thesis Agent", "TRADE")],
      originalVerdict: "SKIP",
      totalResolvedTrades: 1,
      riskVeto: false,
    });
    assert.equal(result, null);
  });

  it("weights high-accuracy agents toward TRADE vs majority SKIP", () => {
    const agents = [
      agent("Bull Thesis Agent", "TRADE", "HIGH"),
      agent("Options Strategy Agent", "TRADE", "HIGH"),
      agent("Bear Thesis Agent", "SKIP", "MEDIUM"),
      agent("Spot Strategy Agent", "SKIP", "MEDIUM"),
      agent("Futures Strategy Agent", "SKIP", "MEDIUM"),
    ];
    const evaluations = [
      evalEntry("Bull Thesis Agent", 88),
      evalEntry("Options Strategy Agent", 82),
      evalEntry("Bear Thesis Agent", 28, { falsePositives: 4 }),
      evalEntry("Spot Strategy Agent", 32, { falsePositives: 2 }),
      evalEntry("Futures Strategy Agent", 30, { falsePositives: 3 }),
    ];

    const result = computeWeightedCommitteeVerdict({
      settings: enabledSettings,
      marketRegime: "Risk-on trend",
      riskProfile: "balanced",
      agents,
      originalVerdict: "SKIP",
      agentEvaluations: evaluations,
      totalResolvedTrades: 8,
      riskVeto: false,
      targetStrategy: "options_short_premium",
    });

    assert.ok(result);
    assert.equal(result.weightedVerdict, "TRADE");
    assert.equal(result.originalVerdict, "SKIP");
    assert.equal(result.verdictDiffers, true);
    assert.ok(result.weightProfile.entries.length > 0);
    assert.ok(result.reasonTrail.length > 0);
  });

  it("risk veto cannot be overridden", () => {
    const agents = [
      agent("Bull Thesis Agent", "TRADE", "HIGH"),
      agent("Bear Thesis Agent", "TRADE", "HIGH"),
      agent("Spot Strategy Agent", "TRADE", "HIGH"),
      agent("Futures Strategy Agent", "TRADE", "HIGH"),
      agent("Options Strategy Agent", "TRADE", "HIGH"),
    ];
    const result = computeWeightedCommitteeVerdict({
      settings: enabledSettings,
      marketRegime: "Risk-on trend",
      riskProfile: "balanced",
      agents,
      originalVerdict: "SKIP",
      agentEvaluations: agents.map((a) => evalEntry(a.agentName, 90)),
      totalResolvedTrades: 10,
      riskVeto: true,
    });
    assert.ok(result);
    assert.equal(result.weightedVerdict, "SKIP");
    assert.ok(
      result.hardGatesApplied.some((g) => g.includes("Risk Manager veto")),
    );
  });

  it("governance hard rules cannot be overridden", () => {
    const { finalVerdict, hardGatesApplied } = applyHardConstraints({
      weightedVerdict: "TRADE",
      riskVeto: false,
      governance: {
        safeMode: false,
        disableAggressiveMode: false,
        pauseAnalysis: false,
        hardRules: {
          locked: true,
          forcedVerdict: "WAIT",
          activeRules: ["daily_loss_cap"],
          messages: ["Cap hit"],
        },
      },
    });
    assert.equal(finalVerdict, "WAIT");
    assert.ok(hardGatesApplied.some((g) => g.includes("Governance hard rules")));
  });

  it("data trust CRITICAL blocks TRADE", () => {
    const { finalVerdict, hardGatesApplied } = applyHardConstraints({
      weightedVerdict: "TRADE",
      riskVeto: false,
      dataTrustCritical: true,
    });
    assert.equal(finalVerdict, "SKIP");
    assert.ok(hardGatesApplied.some((g) => g.includes("Data trust CRITICAL")));
  });

  it("pre-mortem BLOCK cannot be overridden", () => {
    const { finalVerdict, hardGatesApplied } = applyHardConstraints({
      weightedVerdict: "TRADE",
      riskVeto: false,
      preMortemBlock: true,
    });
    assert.equal(finalVerdict, "SKIP");
    assert.ok(hardGatesApplied.some((g) => g.includes("Pre-mortem BLOCK")));
  });
});
