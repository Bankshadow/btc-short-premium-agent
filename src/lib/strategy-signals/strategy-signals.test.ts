import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAdvisorySignalsToDesk } from "./apply-advisory-signals";
import type { AdvisoryStrategySignal } from "./types";
import type { AgentOutput, CommitteeVerdict } from "@/lib/agents/types";

function agent(name: string, rec: AgentOutput["recommendation"]): AgentOutput {
  return {
    agentName: name,
    recommendation: rec,
    strategyType: "FUTURES",
    confidence: "MEDIUM",
    marketView: rec === "TRADE" ? "short bias" : "neutral",
    reasons: ["base reason"],
    risks: [],
    proposedAction: "hold",
    missingData: [],
  };
}

const sampleSignal: AdvisoryStrategySignal = {
  sourceId: "macd-oscillator",
  strategyName: "MACD",
  suggestedUse: "ENTRY",
  signal: "SHORT",
  confidence: "MEDIUM",
  regimeFit: ["bear_trend"],
  reasons: ["MACD histogram negative"],
  risks: ["Whipsaw risk"],
  invalidationCondition: "Histogram crosses zero",
  fedTo: ["FUTURES", "COMMITTEE", "MARKET_DATA"],
  importStatus: "READY_FOR_PAPER",
  advisoryOnly: true,
  executionBlocked: true,
  cannotBypassRiskVeto: true,
  generatedAt: new Date().toISOString(),
};

describe("Strategy signals (MVP 69)", () => {
  it("appends advisory reasons without changing committee verdict", () => {
    const committee: CommitteeVerdict = {
      finalVerdict: "SKIP",
      consensusSummary: "skip",
      riskVeto: true,
      topReasons: ["Risk veto"],
      finalActionPlan: "wait",
      agreementNotes: [],
      disagreementNotes: [],
    };
    const result = applyAdvisorySignalsToDesk({
      signals: [sampleSignal],
      research: { summaryBullets: [], agents: [agent("Market Data Agent", "WAIT")] },
      spot: agent("Spot", "SKIP"),
      futures: agent("Futures Strategy Agent", "TRADE"),
      options: agent("Options Strategy Agent", "SKIP"),
      riskManager: { ...agent("Risk Manager Agent", "SKIP"), veto: true, vetoReasons: ["hard rule"] },
      committee,
    });
    assert.equal(result.committee.finalVerdict, "SKIP");
    assert.equal(result.riskManager.veto, true);
    assert.ok(result.futures.reasons[0].includes("[Quant Advisory"));
    assert.ok(result.committee.topReasons[0].includes("not decisive"));
  });
});
