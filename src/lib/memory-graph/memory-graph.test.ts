import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { buildMemoryGraph } from "./build-graph";
import { getRelevantMemory } from "./get-relevant-memory";

function sampleEntry(overrides: Partial<DecisionLogEntry> = {}): DecisionLogEntry {
  return {
    id: "log-test-1",
    timestamp: new Date().toISOString(),
    btcPrice: 65000,
    marketRegime: "Risk-on trend",
    agentOutputs: [
      {
        agentName: "Options Strategy Agent",
        strategyType: "OPTIONS",
        marketView: "test",
        recommendation: "TRADE",
        confidence: "MEDIUM",
        reasons: ["IV elevated"],
        risks: [],
        proposedAction: "none",
        missingData: [],
      },
    ],
    finalVerdict: "TRADE",
    riskVeto: false,
    topReasons: ["test"],
    actionPlan: "Sell call weekly",
    outcomeStatus: "RESOLVED",
    paperPnl: -3.5,
    reflection: {
      generatedAt: new Date().toISOString(),
      whatWasCorrect: [],
      whatWasWrong: ["Too aggressive near macro"],
      helpfulRiskRules: ["Avoid short call near liquidation cluster"],
      tooAggressiveAgents: ["Options Strategy Agent"],
      suggestedDraftRule: "avoid short call near liquidation cluster",
    },
    ...overrides,
  };
}

describe("memory-graph", () => {
  it("builds nodes and edges from resolved decision log", () => {
    const snapshot = buildMemoryGraph({ entries: [sampleEntry()] });
    assert.ok(snapshot.nodeCount >= 3);
    assert.ok(snapshot.edgeCount >= 1);
    assert.ok(snapshot.nodes.some((n) => n.type === "regime"));
    assert.ok(snapshot.nodes.some((n) => n.type === "agent"));
    assert.ok(snapshot.safetyNotice.includes("advisory"));
  });

  it("retrieves relevant lessons by regime and agent context", () => {
    const snapshot = buildMemoryGraph({ entries: [sampleEntry()] });
    const relevant = getRelevantMemory(snapshot, {
      marketRegime: "Risk-on trend",
      agentsInvolved: ["Options Strategy Agent"],
      riskProfile: "balanced",
      limit: 4,
    });
    assert.equal(relevant.advisoryOnly, true);
    assert.equal(relevant.cannotPlaceTrades, true);
    assert.equal(relevant.cannotBypassGovernance, true);
    assert.ok(relevant.lessons.length > 0);
    assert.ok(relevant.lessons[0].whyUsed.length > 0);
  });

  it("includes rule and outcome node examples", () => {
    const snapshot = buildMemoryGraph({
      entries: [sampleEntry()],
      pinnedNotes: ["avoid short call near liquidation cluster"],
    });
    const hasOutcome = snapshot.nodes.some((n) => n.id.includes("large_loss"));
    const hasRule = snapshot.nodes.some((n) => n.type === "rule");
    assert.ok(hasOutcome || hasRule);
  });
});
