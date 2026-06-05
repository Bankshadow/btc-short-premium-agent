import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { discoverPatterns } from "./discover-patterns";
import { generateProposalsFromPatterns } from "./generate-proposals";
import { buildRuleDiscoveryReport } from "./build-report";
import { approveDiscoveredRulePure } from "./apply-proposal";

function lossEntry(regime: string, id: string): DecisionLogEntry {
  return {
    id,
    timestamp: new Date().toISOString(),
    btcPrice: 65000,
    marketRegime: regime,
    agentOutputs: [],
    finalVerdict: "TRADE",
    riskVeto: false,
    topReasons: ["test"],
    actionPlan: "trade",
    outcomeStatus: "RESOLVED",
    paperPnl: -2,
    reflection: null,
    resolution: {
      btcPriceAfter: 64000,
      tradeWouldWin: false,
      notes: "loss",
      resolvedAt: new Date().toISOString(),
    },
  };
}

describe("rule-discovery", () => {
  it("discovers repeated regime loss patterns", () => {
    const entries = [
      lossEntry("Liquidation stress", "a"),
      lossEntry("Liquidation stress", "b"),
    ];
    const patterns = discoverPatterns({ entries });
    assert.ok(
      patterns.some(
        (p) =>
          p.category === "regime_loss" || p.category === "liquidation_risk",
      ),
    );
  });

  it("generates proposals with impact simulation", () => {
    const entries = [
      lossEntry("Macro caution", "m1"),
      lossEntry("Macro caution", "m2"),
    ];
    const patterns = discoverPatterns({ entries });
    const proposals = generateProposalsFromPatterns(patterns, entries);
    assert.ok(proposals.length > 0);
    assert.equal(proposals[0].humanApprovalRequired, true);
    assert.ok(proposals[0].estimatedImpact.netImpactPct !== undefined);
  });

  it("approves proposal into draft rule shape without auto-live", () => {
    const entries = [lossEntry("Risk-off trend", "r1"), lossEntry("Risk-off trend", "r2")];
    const report = buildRuleDiscoveryReport({ entries });
    const proposal = report.proposals[0];
    assert.ok(proposal);
    const approved = approveDiscoveredRulePure(proposal, {
      proposalId: proposal.ruleId,
      reviewerNote: "test",
    });
    assert.ok(approved);
    assert.equal(approved.draftRule.status, "approved");
    assert.equal(approved.proposal.lifecycle, "active");
    assert.equal(approved.proposal.reversible, true);
  });
});
