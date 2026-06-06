import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAgentOsDashboardState } from "./build-agent-os-state";
import { evaluatePermission, evaluateAllPermissions } from "./permission-matrix";
import { resolveAgentOsMode } from "./resolve-mode";

describe("Agent OS (MVP 71)", () => {
  it("OBSERVE blocks analysis and orders", () => {
    const mode = resolveAgentOsMode({ observeOnly: true });
    assert.equal(mode, "OBSERVE");
    const analysis = evaluatePermission("RUN_ANALYSIS", { mode });
    assert.equal(analysis.blocked, true);
    const paper = evaluatePermission("CREATE_PAPER_TRADE", { mode });
    assert.equal(paper.blocked, true);
  });

  it("ANALYZE allows analysis but not paper trades", () => {
    const mode = resolveAgentOsMode({ autopilotEnabled: true });
    assert.equal(mode, "ANALYZE");
    assert.equal(evaluatePermission("RUN_ANALYSIS", { mode }).allowed, true);
    assert.equal(evaluatePermission("CREATE_PAPER_TRADE", { mode }).blocked, true);
  });

  it("PAPER_AUTOPILOT allows shadow trades", () => {
    const mode = resolveAgentOsMode({
      autopilotEnabled: true,
      paperAutopilotEnabled: true,
    });
    assert.equal(mode, "PAPER_AUTOPILOT");
    assert.equal(evaluatePermission("CREATE_SHADOW_TRADE", { mode }).allowed, true);
    assert.equal(evaluatePermission("EXECUTE_TESTNET_ORDER", { mode }).blocked, true);
  });

  it("TESTNET_ASSISTED requires permission for execute", () => {
    const mode = resolveAgentOsMode({
      testnetConnected: true,
      automationEnabled: true,
    });
    assert.equal(mode, "TESTNET_ASSISTED");
    const preview = evaluatePermission("CREATE_TESTNET_PREVIEW", { mode });
    assert.equal(preview.allowed, true);
    assert.equal(preview.requiresPermission, false);
    const execute = evaluatePermission("EXECUTE_TESTNET_ORDER", { mode });
    assert.equal(execute.requiresPermission, true);
    assert.equal(execute.blocked, true);
    const approved = evaluatePermission("EXECUTE_TESTNET_ORDER", {
      mode,
      onceApproved: true,
    });
    assert.equal(approved.allowed, true);
  });

  it("TESTNET_ALLOW_ALL_SAFE auto-executes within limits", () => {
    const mode = resolveAgentOsMode({
      testnetConnected: true,
      testnetAllowAllSafe: true,
      testnetAllowAllExplicitlyEnabled: true,
    });
    assert.equal(mode, "TESTNET_ALLOW_ALL_SAFE");
    const ok = evaluatePermission("EXECUTE_TESTNET_ORDER", {
      mode,
      testnetTradesToday: 2,
      maxAutoTestnetTradesPerDay: 5,
    });
    assert.equal(ok.allowed, true);
    const over = evaluatePermission("EXECUTE_TESTNET_ORDER", {
      mode,
      testnetTradesToday: 5,
      maxAutoTestnetTradesPerDay: 5,
    });
    assert.equal(over.blocked, true);
  });

  it("ENABLE_LIVE is always blocked", () => {
    const live = evaluatePermission("ENABLE_LIVE", {
      mode: "TESTNET_ALLOW_ALL_SAFE",
    });
    assert.equal(live.blocked, true);
    assert.equal(live.allowed, false);
  });

  it("builds dashboard state with permission flag", () => {
    const state = buildAgentOsDashboardState({
      testnetConnected: true,
      automationEnabled: true,
      pendingAction: "EXECUTE_TESTNET_ORDER",
      goalProgressPct: 12,
      nextAction: "Review testnet preview",
    });
    assert.equal(state.permissionNeeded, true);
    assert.equal(state.liveLocked, true);
    assert.ok(state.pendingPermission?.title.includes("testnet"));
    assert.equal(state.goalProgressPct, 12);
  });

  it("returns full permission matrix", () => {
    const matrix = evaluateAllPermissions({ mode: "ANALYZE" });
    assert.equal(matrix.length, 11);
    assert.ok(matrix.every((r) => r.requiredMode));
  });
});
