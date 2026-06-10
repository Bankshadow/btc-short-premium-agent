import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JournalEvent } from "@/lib/journal/journal-types";
import {
  deriveLifecycleState,
  deriveTradeLifecycleState,
  validateAllTradeLifecycles,
  validateLifecycleTransition,
} from "@/lib/core/lifecycle-state-machine";

const RUN = "run-lc";
const DL = "dl-lc";
const PREVIEW = "prev-lc";
const TRADE_A = "trade-a";
const TRADE_B = "trade-b";

function evt(
  partial: Partial<JournalEvent> & Pick<JournalEvent, "type">,
): JournalEvent {
  return {
    eventId: `evt-${partial.type}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: partial.timestamp ?? new Date().toISOString(),
    environment: "testnet",
    payload: partial.payload ?? {},
    ...partial,
  } as JournalEvent;
}

function fullHappyPathEvents(tradeId: string): JournalEvent[] {
  const t0 = "2026-06-06T10:00:00.000Z";
  const step = (i: number) => `2026-06-06T10:00:${String(i).padStart(2, "0")}.000Z`;
  return [
    evt({ type: "ANALYSIS_STARTED", runId: RUN, decisionLogId: DL, timestamp: t0 }),
    evt({ type: "VERDICT_CREATED", runId: RUN, decisionLogId: DL, tradeId, timestamp: step(1), payload: { verdict: "TRADE" } }),
    evt({ type: "PREVIEW_CREATED", runId: RUN, decisionLogId: DL, previewId: PREVIEW, timestamp: step(2) }),
    evt({
      type: "EXECUTION_REVIEWED",
      runId: RUN,
      decisionLogId: DL,
      previewId: PREVIEW,
      timestamp: step(3),
      payload: { allowed: true, doubleConfirm: true },
    }),
    evt({
      type: "ORDER_EXECUTED",
      runId: RUN,
      decisionLogId: DL,
      previewId: PREVIEW,
      tradeId,
      timestamp: step(4),
      payload: { symbol: "BTCUSDT" },
    }),
    evt({ type: "POSITION_OPENED", tradeId, timestamp: step(5) }),
    evt({ type: "POSITION_MONITORED", tradeId, timestamp: step(6) }),
    evt({ type: "CLOSE_PREVIEW_CREATED", tradeId, closePreviewId: "cprev-1", timestamp: step(7) }),
    evt({
      type: "CLOSE_REVIEWED",
      tradeId,
      closePreviewId: "cprev-1",
      timestamp: step(8),
      payload: { allowed: true },
    }),
    evt({ type: "CLOSE_ORDER_EXECUTED", tradeId, timestamp: step(9) }),
    evt({ type: "POSITION_CLOSED", tradeId, timestamp: step(10) }),
    evt({ type: "PNL_REALIZED", tradeId, timestamp: step(11), payload: { netPnl: 1 } }),
    evt({ type: "LEARNING_RECORD_CREATED", tradeId, timestamp: step(12) }),
    evt({ type: "EVIDENCE_TRADE_VALIDATED", tradeId, timestamp: step(13) }),
  ];
}

describe("Lifecycle state machine (Slice 2)", () => {
  it("zero trade events → CREATED with warning", () => {
    const snap = deriveLifecycleState("empty-trade", []);
    assert.equal(snap.state, "CREATED");
    assert.equal(snap.eventCount, 0);
    assert.ok(snap.issues.some((i) => i.code === "NO_TRADE_EVENTS"));
    assert.equal(snap.invalidTransitions.length, 0);
  });

  it("full happy path reaches EVIDENCE_VALIDATED", () => {
    const events = fullHappyPathEvents(TRADE_A);
    const snap = deriveLifecycleState(TRADE_A, events);
    assert.equal(snap.state, "EVIDENCE_VALIDATED");
    assert.equal(snap.invalidTransitions.length, 0);
    assert.equal(snap.issues.filter((i) => i.severity === "BLOCK").length, 0);
  });

  it("ORDER_EXECUTED without EXECUTION_REVIEWED → INVALID + invalidTransitions", () => {
    const events = [
      evt({
        type: "ORDER_EXECUTED",
        tradeId: TRADE_A,
        previewId: PREVIEW,
        payload: { symbol: "BTCUSDT" },
      }),
    ];
    const snap = deriveTradeLifecycleState(TRADE_A, events);
    assert.equal(snap.state, "INVALID");
    assert.ok(snap.issues.some((i) => i.code === "ORDER_WITHOUT_SAFETY_REVIEW"));
    assert.ok(snap.invalidTransitions.some((i) => i.code === "ORDER_WITHOUT_SAFETY_REVIEW"));
  });

  it("PNL_REALIZED without POSITION_CLOSED → INVALID", () => {
    const events = [evt({ type: "PNL_REALIZED", tradeId: TRADE_A, payload: { netPnl: 1 } })];
    const snap = deriveLifecycleState(TRADE_A, events);
    assert.equal(snap.state, "INVALID");
    assert.ok(snap.issues.some((i) => i.code === "PNL_WITHOUT_CLOSE"));
  });

  it("EXECUTE_BLOCKED → terminal BLOCKED state", () => {
    const events = [
      evt({ type: "EXECUTE_BLOCKED", tradeId: TRADE_A, payload: { reason: "test" } }),
    ];
    const snap = deriveLifecycleState(TRADE_A, events);
    assert.equal(snap.state, "BLOCKED");
  });

  it("multiple trades isolated by tradeId", () => {
    const eventsA = fullHappyPathEvents(TRADE_A);
    const eventsB = [
      evt({ type: "PNL_REALIZED", tradeId: TRADE_B, payload: { netPnl: -1 } }),
    ];
    const all = [...eventsA, ...eventsB];
    const snapA = deriveLifecycleState(TRADE_A, all);
    const snapB = deriveLifecycleState(TRADE_B, all);
    assert.equal(snapA.state, "EVIDENCE_VALIDATED");
    assert.equal(snapB.state, "INVALID");
    assert.ok(snapB.issues.some((i) => i.code === "PNL_WITHOUT_CLOSE"));
  });

  it("validateLifecycleTransition strict flags LEARNING without PnL", () => {
    const existing = [
      evt({ type: "POSITION_CLOSED", tradeId: TRADE_A }),
    ];
    const issues = validateLifecycleTransition(
      { type: "LEARNING_RECORD_CREATED", tradeId: TRADE_A },
      existing,
      { mode: "strict" },
    );
    assert.ok(issues.some((i) => i.code === "LEARNING_WITHOUT_PNL"));
    assert.equal(issues[0]?.severity, "BLOCK");
  });

  it("validateAllTradeLifecycles read mode downgrades BLOCK to WARNING", () => {
    const events = [evt({ type: "PNL_REALIZED", tradeId: TRADE_A, payload: { netPnl: 1 } })];
    const issues = validateAllTradeLifecycles(events, { mode: "read" });
    assert.ok(issues.some((i) => i.code === "PNL_WITHOUT_CLOSE"));
    assert.equal(issues.find((i) => i.code === "PNL_WITHOUT_CLOSE")?.severity, "WARNING");
  });

  it("deriveLifecycleState is alias for deriveTradeLifecycleState", () => {
    const events = fullHappyPathEvents(TRADE_A);
    const a = deriveLifecycleState(TRADE_A, events);
    const b = deriveTradeLifecycleState(TRADE_A, events);
    assert.deepEqual(a.state, b.state);
    assert.deepEqual(a.invalidTransitions, b.invalidTransitions);
  });
});
