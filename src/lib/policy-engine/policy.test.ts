import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePolicy, policyAllows } from "./evaluate";
import { buildPolicyInput } from "./build-context";
import { POLICY_RULES } from "./config";
import type { PolicyInput } from "./types";

function baseInput(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    workspaceId: "ws-test",
    userRole: "TRADER",
    environmentMode: "PAPER",
    action: "RUN_ANALYSIS",
    auditAvailable: true,
    backboneHealthy: true,
    ...overrides,
  };
}

describe("P-MVP 5 Policy Engine", () => {
  it("allows RUN_ANALYSIS for TRADER without blockers", () => {
    const result = evaluatePolicy(baseInput({ action: "RUN_ANALYSIS" }));
    assert.equal(result.decision, "ALLOW");
  });

  it("blocks VIEWER from RUN_ANALYSIS", () => {
    const result = evaluatePolicy(
      baseInput({ action: "RUN_ANALYSIS", userRole: "VIEWER" }),
    );
    assert.equal(result.decision, "BLOCK");
    assert.ok(result.blockers.some((b) => b.includes("VIEWER")));
  });

  it("fail-closed blocks live perp when command center not SAFE", () => {
    const result = evaluatePolicy(
      baseInput({
        action: "EXECUTE_LIVE_PERP",
        environmentMode: "LIVE_ENABLED",
        commandCenter: { status: "BLOCKED", blockers: ["Kill switch active"] },
        operatorApproval: true,
        doubleConfirm: true,
      }),
    );
    assert.equal(result.decision, "BLOCK");
    assert.ok(result.ruleIds.includes("command_center_safe"));
  });

  it("requires approval for live perp without operator sign-off", () => {
    const result = evaluatePolicy(
      baseInput({
        action: "EXECUTE_LIVE_PERP",
        environmentMode: "LIVE_ENABLED",
        commandCenter: { status: "SAFE", blockers: [] },
        operatorApproval: false,
        doubleConfirm: true,
      }),
    );
    assert.equal(result.decision, "REQUIRE_APPROVAL");
    assert.ok(result.requiredApprovals.includes("OPERATOR_APPROVAL"));
  });

  it("blocks EXECUTE_OPTIONS_LIVE", () => {
    const result = evaluatePolicy(
      baseInput({ action: "EXECUTE_OPTIONS_LIVE", userRole: "OWNER" }),
    );
    assert.equal(result.decision, "BLOCK");
  });

  it("allows shadow under relaxed conditions", () => {
    const result = evaluatePolicy(
      baseInput({
        action: "CREATE_SHADOW_TRADE",
        risk: { killSwitchActive: false, tradingPaused: false, hardRiskVeto: true },
      }),
    );
    assert.notEqual(result.decision, "BLOCK");
  });

  it("blocks paper on pre-mortem BLOCK", () => {
    const result = evaluatePolicy(
      baseInput({
        action: "CREATE_PAPER_TRADE",
        preMortem: { blocksTicket: true, summary: "Tail risk too high" },
      }),
    );
    assert.equal(result.decision, "BLOCK");
  });

  it("policyAllows returns true only for ALLOW", () => {
    assert.equal(policyAllows(baseInput({ action: "RUN_ANALYSIS" })), true);
    assert.equal(
      policyAllows(baseInput({ action: "RUN_ANALYSIS", userRole: "VIEWER" })),
      false,
    );
  });

  it("defines rules for all action types", () => {
    const actions = new Set(POLICY_RULES.flatMap((r) => r.appliesTo));
    assert.ok(actions.has("RUN_ANALYSIS"));
    assert.ok(actions.has("EXECUTE_LIVE_PERP"));
    assert.ok(actions.has("TRIGGER_KILL_SWITCH"));
  });

  it("buildPolicyInput maps governance pause", () => {
    const input = buildPolicyInput({
      workspaceId: "ws-1",
      userRole: "ADMIN",
      environmentMode: "PAPER",
      action: "RUN_ANALYSIS",
      governance: { pauseAnalysis: true } as never,
    });
    const result = evaluatePolicy(input);
    assert.equal(result.decision, "BLOCK");
  });
});
