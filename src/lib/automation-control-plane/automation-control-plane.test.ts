import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUTOMATION_GUARANTEES, isAutomationActionAllowed } from "./safety";
import { backoffMinutesForFailures } from "./config";
import { buildAutomationFailureAction } from "./failure-actions";
import type { AutomationJobType } from "./types";

describe("P-MVP 4 Automation Control Plane", () => {
  it("enforces safety guarantees", () => {
    assert.equal(AUTOMATION_GUARANTEES.cannotApproveLiveTrades, true);
    assert.equal(AUTOMATION_GUARANTEES.cannotIncreaseRisk, true);
    assert.equal(AUTOMATION_GUARANTEES.cannotDisableKillSwitch, true);
  });

  it("blocks risk-increasing automation actions", () => {
    assert.equal(isAutomationActionAllowed("APPROVE_LIVE_TRADE"), false);
    assert.equal(isAutomationActionAllowed("INCREASE_RISK"), false);
    assert.equal(isAutomationActionAllowed("DISABLE_KILL_SWITCH"), false);
    assert.equal(isAutomationActionAllowed("PAUSE_ANALYSIS"), true);
  });

  it("applies exponential backoff on failures", () => {
    assert.equal(backoffMinutesForFailures(0), 0);
    assert.equal(backoffMinutesForFailures(1), 2);
    assert.equal(backoffMinutesForFailures(3), 8);
    assert.ok(backoffMinutesForFailures(10) <= 60);
  });

  it("creates operator action on job failure", () => {
    const action = buildAutomationFailureAction(
      "DESK_ANALYZE" as AutomationJobType,
      "Backbone unhealthy",
      "acp-test-run",
      "ws-test",
    );
    assert.equal(action.type, "REVIEW_RISK_BLOCKER");
    assert.equal(action.status, "OPEN");
    assert.equal(action.priority, "HIGH");
    assert.ok(action.title.includes("DESK_ANALYZE"));
  });

  it("defaults to testnet perp spine when autoexec enabled", async () => {
    const prev = process.env.BINANCE_TESTNET_AUTOEXECUTE_ENABLED;
    const prevMode = process.env.AUTOMATION_PRIMARY_MODE;
    process.env.BINANCE_TESTNET_AUTOEXECUTE_ENABLED = "true";
    delete process.env.AUTOMATION_PRIMARY_MODE;
    const { resolveDefaultAutomationJobs, isTestnetPrimaryAutomation } =
      await import("./primary-mode");
    assert.equal(isTestnetPrimaryAutomation(), true);
    assert.deepEqual(resolveDefaultAutomationJobs(), [
      "DESK_ANALYZE",
      "COMMAND_CENTER_REFRESH",
      "BINANCE_TESTNET_MONITOR",
      "BINANCE_TESTNET_AUTOEXECUTE",
      "LEARNING_UPDATE",
      "SELF_LEARNING_UPDATE",
    ]);
    if (prev === undefined) delete process.env.BINANCE_TESTNET_AUTOEXECUTE_ENABLED;
    else process.env.BINANCE_TESTNET_AUTOEXECUTE_ENABLED = prev;
    if (prevMode === undefined) delete process.env.AUTOMATION_PRIMARY_MODE;
    else process.env.AUTOMATION_PRIMARY_MODE = prevMode;
  });
});
