import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { migrateLocalStorageToWarehouse } from "./migrate-local";
import { writeThroughDecisionLogs, writeThroughPaperTrades } from "./write-through";
import { buildDbStatusReport } from "./warehouse-status";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";

function sampleEntry(): DecisionLogEntry {
  return {
    id: "log-test-1",
    timestamp: new Date().toISOString(),
    btcPrice: 90000,
    marketRegime: "RANGE",
    agentOutputs: [
      {
        agentName: "Risk",
        recommendation: "WAIT",
        confidence: 60,
        reasons: ["test"],
        risks: [],
      },
    ],
    finalVerdict: "WAIT",
    riskVeto: false,
    topReasons: ["test"],
    actionPlan: "wait",
    outcomeStatus: "PENDING",
    paperPnl: null,
    reflection: null,
    replaySnapshot: null,
    falseTradeFlag: false,
    falseSkipFlag: false,
    missedOpportunityR: 0,
    avoidedLossR: 0,
    lessonTags: [],
  };
}

describe("warehouse MVP 41", () => {
  it("writes decision logs to file backend", async () => {
    const r = await writeThroughDecisionLogs([sampleEntry()]);
    assert.equal(r.ok, true);
    assert.ok(r.written >= 1);
  });

  it("migrates local payload without deleting localStorage flag", async () => {
    const r = await migrateLocalStorageToWarehouse({
      decisionLogs: [sampleEntry()],
    });
    assert.equal(r.localStoragePreserved, true);
    assert.ok((r.tables.decision_logs ?? 0) >= 1);
  });

  it("buildDbStatusReport returns warehouse backend", async () => {
    const report = await buildDbStatusReport();
    assert.ok(["supabase", "file"].includes(report.backend));
    assert.equal(report.sourceOfTruth, "warehouse");
    assert.ok(report.tables.decision_logs.count >= 0);
  });

  it("writeThroughPaperTrades accepts empty list", async () => {
    const r = await writeThroughPaperTrades([]);
    assert.equal(r.ok, true);
    assert.equal(r.written, 0);
  });
});
