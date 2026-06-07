import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAutomationDue,
  normalizeCronIntervalMinutes,
} from "./cron-config";
import { defaultAutomationState } from "./state-store";

describe("cron config", () => {
  it("normalizes interval to 1–120 minutes", () => {
    assert.equal(normalizeCronIntervalMinutes(0), 1);
    assert.equal(normalizeCronIntervalMinutes(3), 3);
    assert.equal(normalizeCronIntervalMinutes(999), 120);
  });

  it("is due when never run and enabled", () => {
    const state = defaultAutomationState();
    state.settings.automationEnabled = true;
    state.settings.paused = false;
    assert.equal(isAutomationDue(state), true);
  });

  it("is not due immediately after run timestamp", () => {
    const state = defaultAutomationState();
    state.settings.automationEnabled = true;
    state.settings.intervalMinutes = 15;
    state.lastRun = {
      runId: "r1",
      workspaceId: "server-default",
      status: "SUCCESS",
      trigger: "cron",
      idempotencyKey: "k",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      jobs: [],
      errors: [],
      nextRunAt: null,
      safetyNotice: "",
      cannotApproveLiveTrades: true,
      cannotIncreaseRisk: true,
      cannotDisableKillSwitch: true,
    };
    assert.equal(isAutomationDue(state), false);
  });
});
