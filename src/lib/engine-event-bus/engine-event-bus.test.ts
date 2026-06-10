import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeEngineEventPayload, sanitizeEngineEventText } from "./sanitize";
import { MEANINGFUL_ENGINE_EVENT_TYPES, DASHBOARD_ALERT_EVENT_TYPES } from "./types";

describe("engine event bus mvp85", () => {
  it("redacts secret-like payload keys", () => {
    const clean = sanitizeEngineEventPayload({
      runId: "cae-1",
      api_key: "super-secret-key-value",
      BINANCE_API_SECRET: "abc123",
      confidence: 72,
    });
    assert.equal(clean.runId, "cae-1");
    assert.equal(clean.confidence, 72);
    assert.equal(clean.api_key, undefined);
    assert.equal(clean.BINANCE_API_SECRET, undefined);
  });

  it("marks meaningful and dashboard alert event types", () => {
    assert.ok(MEANINGFUL_ENGINE_EVENT_TYPES.has("VERDICT_CREATED"));
    assert.ok(MEANINGFUL_ENGINE_EVENT_TYPES.has("PREVIEW_CREATED"));
    assert.ok(!MEANINGFUL_ENGINE_EVENT_TYPES.has("CONTEXT_BUILT"));
    assert.ok(DASHBOARD_ALERT_EVENT_TYPES.has("BLOCKER_CREATED"));
  });

  it("sanitizes long secret patterns in text", () => {
    const text = sanitizeEngineEventText("Connected sk-abcdefghijklmnopqrstuvwxyz123456");
    assert.ok(!text.includes("sk-abcdefghijklmnopqrstuvwxyz123456"));
    assert.ok(text.includes("[redacted]"));
  });
});
