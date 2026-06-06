import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAiStatusCardState } from "./build-card-state";
import type { AiStatusEvent } from "./types";

function evt(type: AiStatusEvent["type"], minsAgo = 0): AiStatusEvent {
  return {
    id: `e-${type}`,
    type,
    label: type,
    timestamp: new Date(Date.now() - minsAgo * 60_000).toISOString(),
    runId: "run-1",
  };
}

describe("AI status card (MVP 72)", () => {
  it("builds progress from latest pipeline event", () => {
    const state = buildAiStatusCardState({
      events: [evt("AGENTS_REVIEWED"), evt("MARKET_FETCHED", 1)],
      activeRunId: "run-1",
    });
    assert.equal(state.progressPct, 50);
    assert.equal(state.isActive, true);
    assert.ok(state.currentStep.includes("Committee"));
  });

  it("flags permission needed", () => {
    const state = buildAiStatusCardState({
      events: [evt("PERMISSION_REQUESTED"), evt("TESTNET_PREVIEW_CREATED", 1)],
      permissionNeeded: true,
      permissionReason: "Approve testnet execute",
    });
    assert.equal(state.permissionNeeded, true);
    assert.equal(state.permissionReason, "Approve testnet execute");
  });

  it("returns last 5 tool actions", () => {
    const events = Array.from({ length: 8 }, (_, i) =>
      evt("MARKET_FETCHED", i),
    );
    const state = buildAiStatusCardState({ events });
    assert.equal(state.recentToolActions.length, 5);
  });

  it("idle when no recent events", () => {
    const state = buildAiStatusCardState({
      events: [evt("LEARNING_UPDATED", 5)],
    });
    assert.equal(state.isActive, false);
    assert.ok(state.currentTask.includes("Standing by"));
    assert.equal(state.loopBlocker.active, false);
    assert.equal(state.memorySummary, null);
    assert.equal(state.committeeSummary, null);
  });

  it("surfaces loop guard blocker on card", () => {
    const state = buildAiStatusCardState({
      events: [],
      loopGuard: {
        blocker: {
          active: true,
          reason: "Autopilot stuck — repeated failures",
          stoppedAt: new Date().toISOString(),
          actionItemId: "oa-1",
          loopRiskLevel: "STUCK",
          metrics: null,
        },
      },
    });
    assert.equal(state.loopBlocker.active, true);
    assert.equal(state.permissionNeeded, true);
    assert.ok(state.currentTask.includes("paused"));
  });
});
