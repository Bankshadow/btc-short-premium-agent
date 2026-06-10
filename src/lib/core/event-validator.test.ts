import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateCoreEvent, validateRawCoreEvent, validateEventEnvelope } from "@/lib/core/event-validator";
import { normalizeToCoreEvent } from "@/lib/core/event-normalizer";
import { validateSecretLeakage } from "@/lib/core/secret-leakage-validator";
import type { CoreEvent } from "@/lib/core/event-types";
import { CORE_EVENT_SCHEMA_VERSION, CORE_EVENT_VERSION } from "@/lib/core/event-types";

function validCoreEvent(overrides: Partial<CoreEvent> = {}): CoreEvent {
  return {
    eventId: "evt-test-001",
    type: "ANALYSIS_STARTED",
    timestamp: "2026-06-06T12:00:00.000Z",
    version: CORE_EVENT_VERSION,
    environment: "TESTNET",
    runId: "run-test-001",
    decisionLogId: "dl-test-001",
    source: "SYSTEM",
    payload: { trigger: "manual" },
    metadata: {
      schemaVersion: CORE_EVENT_SCHEMA_VERSION,
      createdBy: "SYSTEM",
      safeToReplay: true,
      correlationId: "run-test-001",
    },
    ...overrides,
  };
}

describe("Core event validator (Slice 1)", () => {
  it("valid CoreEvent passes", () => {
    const result = validateCoreEvent(validCoreEvent());
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it("missing eventId fails", () => {
    const result = validateCoreEvent(validCoreEvent({ eventId: "" }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === "MISSING_EVENT_ID"));
  });

  it("missing timestamp fails", () => {
    const result = validateCoreEvent(validCoreEvent({ timestamp: "" }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === "MISSING_TIMESTAMP"));
  });

  it("invalid timestamp fails", () => {
    const result = validateCoreEvent(validCoreEvent({ timestamp: "not-a-date" }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === "INVALID_TIMESTAMP"));
  });

  it("missing metadata.schemaVersion fails", () => {
    const result = validateCoreEvent(
      validCoreEvent({
        metadata: {
          schemaVersion: "",
          createdBy: "SYSTEM",
          safeToReplay: true,
        },
      }),
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === "MISSING_SCHEMA_VERSION"));
  });

  it("payload must be object", () => {
    const result = validateCoreEvent(validCoreEvent({ payload: [] as unknown as Record<string, unknown> }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === "INVALID_PAYLOAD"));
  });

  it("secret key in payload fails", () => {
    const result = validateCoreEvent(
      validCoreEvent({ type: "ERROR_RECORDED", payload: { apiSecret: "leaked-value" } }),
    );
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some(
        (e) => e.code === "SECRET_KEY_FORBIDDEN" || e.code === "SECRET_VALUE_REDACTABLE",
      ),
    );
    assert.ok(result.errors.some((e) => e.severity === "CRITICAL"));
  });

  it("secret key nested deeply fails", () => {
    const result = validateCoreEvent(
      validCoreEvent({
        type: "ERROR_RECORDED",
        payload: { nested: { deep: { authorization: "Bearer abc.def.ghi" } } },
      }),
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === "SECRET_KEY_FORBIDDEN" || e.code === "BEARER_TOKEN_DETECTED"));
  });

  it("authorization header pattern fails", () => {
    const leakage = validateSecretLeakage(
      { headers: { authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token" } },
      undefined,
    );
    assert.ok(leakage.hasCritical);
    assert.ok(leakage.issues.some((i) => i.code === "SECRET_KEY_FORBIDDEN" || i.code === "BEARER_TOKEN_DETECTED"));
  });

  it("old journal event can be normalized", () => {
    const { event, warnings } = normalizeToCoreEvent({
      eventId: "evt-legacy-1",
      type: "VERDICT_CREATED",
      timestamp: "2026-06-06T12:00:01.000Z",
      environment: "testnet",
      runId: "run-legacy",
      decisionLogId: "dl-legacy",
      payload: { verdict: "WAIT", confidence: 50, reasons: [] },
    });
    assert.equal(event.environment, "TESTNET");
    assert.equal(event.metadata.schemaVersion, CORE_EVENT_SCHEMA_VERSION);
    assert.equal(event.source, "SYSTEM");
    assert.ok(warnings.length >= 1);
  });

  it("normalized old event produces warnings not crash", () => {
    const result = validateRawCoreEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      payload: { symbol: "BTCUSDT" },
    });
    assert.ok(Array.isArray(result.warnings));
    assert.ok(result.normalizedEvent);
    assert.equal(result.normalizedEvent?.environment, "TESTNET");
  });

  it("live order-like event blocked for non-testnet environment", () => {
    const result = validateCoreEvent(
      validCoreEvent({
        type: "ORDER_EXECUTED",
        environment: "UNKNOWN",
        tradeId: "trade-1",
        previewId: "prev-1",
        payload: { symbol: "BTCUSDT", side: "SELL" },
      }),
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === "LIVE_TRADING_EVENT"));
  });

  it("testnet order event passes environment check", () => {
    const result = validateCoreEvent(
      validCoreEvent({
        type: "ORDER_EXECUTED",
        tradeId: "trade-1",
        previewId: "prev-1",
        environment: "TESTNET",
        payload: { symbol: "BTCUSDT" },
      }),
    );
    assert.ok(!result.errors.some((e) => e.code === "LIVE_TRADING_EVENT"));
  });

  it("MiroFish event validates without execution payload", () => {
    const result = validateCoreEvent(
      validCoreEvent({
        type: "MIROFISH_SCENARIO_REPORT_CREATED",
        payload: { reportId: "swarm-1", summary: "advisory only" },
      }),
    );
    assert.equal(result.valid, true);
  });

  it("MiroFish event rejects execution payload fields", () => {
    const result = validateCoreEvent(
      validCoreEvent({
        type: "MIROFISH_SCENARIO_REPORT_CREATED",
        payload: { reportId: "swarm-1", orderId: "12345", avgPrice: 50000 },
      }),
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === "MIROFISH_EXECUTION_PAYLOAD"));
  });

  it("legacy envelope validator still works for append input", () => {
    const result = validateEventEnvelope({
      type: "ANALYSIS_STARTED",
      environment: "testnet",
      runId: "run-1",
      decisionLogId: "dl-1",
      payload: { trigger: "manual" },
    });
    assert.equal(result.valid, true);
  });

  it("legacy envelope rejects live environment", () => {
    const result = validateEventEnvelope({
      type: "ANALYSIS_STARTED",
      environment: "live" as "testnet",
      payload: {},
    });
    assert.equal(result.valid, false);
  });

  it("liveEnabled in payload fails via secret leakage", () => {
    const result = validateCoreEvent(
      validCoreEvent({ type: "ERROR_RECORDED", payload: { liveEnabled: true } }),
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === "LIVE_TRADING_LEAK"));
  });
});
