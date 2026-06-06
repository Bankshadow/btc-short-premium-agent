import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  computeLoopGuardMetrics,
  evaluateLoopGuardFromState,
} from "./evaluate-loop";
import { checkOrderHardSafety } from "./hard-safety";
import { buildPreviewFingerprint, buildActionKey } from "./fingerprints";
import { defaultLoopGuardState, resetLoopGuardStateForTests } from "./guard-store";
import { runPreCycleLoopCheck, clearLoopGuardBlocker } from "./run-guard";
import type { LoopGuardActionRecord } from "./types";

function record(
  partial: Partial<LoopGuardActionRecord> & Pick<LoopGuardActionRecord, "actionKey">,
): LoopGuardActionRecord {
  return {
    id: `r-${Math.random()}`,
    actionType: "DESK_ANALYZE",
    success: false,
    failed: true,
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

describe("Autopilot loop guard (MVP 73)", () => {
  beforeEach(async () => {
    await resetLoopGuardStateForTests();
  });

  it("hard safety blocks missing double confirm", () => {
    const result = checkOrderHardSafety({
      previewId: "p1",
      symbol: "BTCUSDT",
      side: "SELL",
      doubleConfirm: false,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.violation, "NO_DOUBLE_CONFIRM");
  });

  it("hard safety blocks duplicate testnet order", () => {
    const result = checkOrderHardSafety({
      previewId: "p1",
      symbol: "BTCUSDT",
      side: "SELL",
      doubleConfirm: true,
      submittedPreviewIds: ["p1"],
    });
    assert.equal(result.allowed, false);
    assert.equal(result.violation, "DUPLICATE_ORDER");
  });

  it("hard safety blocks duplicate preview fingerprint", () => {
    const fp = buildPreviewFingerprint({
      symbol: "ETHUSDT",
      side: "BUY",
      notionalUsd: 100,
    });
    const result = checkOrderHardSafety({
      previewId: "p2",
      symbol: "ETHUSDT",
      side: "BUY",
      doubleConfirm: true,
      previewFingerprint: fp,
      recentPreviewFingerprints: [fp],
    });
    assert.equal(result.allowed, false);
    assert.equal(result.violation, "DUPLICATE_PREVIEW");
  });

  it("flags suspicious repeated same action", () => {
    const key = buildActionKey("DESK_ANALYZE", "cycle");
    const records = Array.from({ length: 3 }, () =>
      record({ actionKey: key, failed: true, success: false }),
    );
    const metrics = computeLoopGuardMetrics(records);
    assert.equal(metrics.loopRiskLevel, "SUSPICIOUS");
    assert.ok(metrics.reasons.some((r) => r.includes("Same action")));
  });

  it("flags stuck on many failures and stale market", () => {
    const key = buildActionKey("DESK_ANALYZE", "cycle");
    const hash = "100|TRADE|A|RANGE|0.00010";
    const records = Array.from({ length: 6 }, () =>
      record({
        actionKey: key,
        marketContextHash: hash,
        failed: true,
        success: false,
        apiErrorKey: "timeout",
      }),
    );
    const metrics = computeLoopGuardMetrics(records);
    const decision = evaluateLoopGuardFromState({
      ...defaultLoopGuardState(),
      records,
    });
    assert.equal(metrics.loopRiskLevel, "STUCK");
    assert.equal(decision.stopLoop, true);
    assert.equal(decision.continue, false);
  });

  it("pre-cycle check blocks suspicious without permission", async () => {
    const state = defaultLoopGuardState();
    const key = buildActionKey("BINANCE_EXECUTE", "retry");
    state.records = Array.from({ length: 3 }, () =>
      record({ actionType: "BINANCE_EXECUTE", actionKey: key }),
    );
    const { patchLoopGuardState } = await import("./guard-store");
    await patchLoopGuardState(state);
    const result = await runPreCycleLoopCheck();
    assert.equal(result.decision.level, "SUSPICIOUS");
    assert.equal(result.blocked, true);
  });

  it("clears blocker after operator dismiss", async () => {
    const state = defaultLoopGuardState();
    state.blocker = {
      active: true,
      reason: "Test stuck",
      stoppedAt: new Date().toISOString(),
      actionItemId: "oa-1",
      loopRiskLevel: "STUCK",
      metrics: null,
    };
    const { patchLoopGuardState } = await import("./guard-store");
    await patchLoopGuardState(state);
    const cleared = await clearLoopGuardBlocker();
    assert.equal(cleared.blocker.active, false);
  });
});
