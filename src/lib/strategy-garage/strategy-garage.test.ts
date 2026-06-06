import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { deriveGarageStage, nextGarageAction } from "./evaluate-stage";
import { classifyStrategyRisk } from "./risk-classify";
import { resetStrategyGarageForTests } from "./garage-store";

describe("Strategy garage (MVP 81)", () => {
  beforeEach(async () => {
    await resetStrategyGarageForTests();
  });

  it("derives PAUSED-equivalent REJECTED stage", () => {
    assert.equal(
      deriveGarageStage({ record: null, importStatus: "REJECTED" }),
      "REJECTED",
    );
  });

  it("derives TESTNET_READY from READY_FOR_PAPER import", () => {
    assert.equal(
      deriveGarageStage({ record: null, importStatus: "READY_FOR_PAPER" }),
      "TESTNET_READY",
    );
  });

  it("derives APPROVED_FOR_USE when flagged", () => {
    assert.equal(
      deriveGarageStage({
        record: {
          sourceId: "x",
          stage: "APPROVED_FOR_USE",
          importSource: "quant_seed",
          riskClass: "LOW",
          aiReviewSummary: "ok",
          aiReviewedAt: new Date().toISOString(),
          approvedForAiLoop: true,
          approvedForAiLoopAt: new Date().toISOString(),
          lastBacktest: null,
          lastShadow: null,
          importStatus: "READY_FOR_PAPER",
          operatorNote: null,
          updatedAt: new Date().toISOString(),
        },
        importStatus: "READY_FOR_PAPER",
      }),
      "APPROVED_FOR_USE",
    );
  });

  it("classifies entry strategies as higher risk", () => {
    const entry = classifyStrategyRisk({
      suggestedUse: "ENTRY",
      riskNotes: ["Whipsaws in ranging markets"],
      riskWarning: "Do not wire to autopilot",
    });
    const filter = classifyStrategyRisk({
      suggestedUse: "FILTER",
      riskNotes: [],
      riskWarning: "Low risk filter",
    });
    assert.ok(["MEDIUM", "HIGH", "EXTREME"].includes(entry));
    assert.equal(filter, "LOW");
  });

  it("next action mentions human approval path", () => {
    assert.ok(nextGarageAction("TESTNET_READY").includes("testnet"));
    assert.ok(nextGarageAction("APPROVED_FOR_USE").toLowerCase().includes("advisory"));
  });
});
