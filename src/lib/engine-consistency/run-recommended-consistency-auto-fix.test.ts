import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldSkipConsistencyAutoFixCooldown } from "./run-recommended-consistency-auto-fix";
import type { EngineConsistencySnapshot } from "./types";

function snapshot(
  partial: Partial<EngineConsistencySnapshot> &
    Pick<EngineConsistencySnapshot, "consistencyStatus" | "autoFixActions">,
): EngineConsistencySnapshot {
  return {
    mvp: 88,
    label: "Engine Consistency & Reconciliation",
    consistencyLabel: "Blocked",
    positionStateUncertain: true,
    blocksNewTrades: true,
    issues: [],
    autoFixAvailable: partial.autoFixActions.length > 0,
    requiredManualActions: [],
    generatedAt: new Date().toISOString(),
    storeSummary: {
      decisionLogCount: 0,
      tradeJournalCount: 0,
      monitorEventCount: 0,
      learningRecordCount: 0,
      binanceOpenPositions: 0,
      localOpenTrades: 0,
      missionDecisionLogId: null,
      centralDecisionLogId: null,
      missionNetPnl: 0,
      dashboardNetPnl: 0,
    },
    ...partial,
  };
}

describe("runRecommendedConsistencyAutoFixIfNeeded", () => {
  it("uses shorter cooldown for BLOCKED consistency", () => {
    const fp = "decision_log_backfill,journal_backfill";
    const now = Date.parse("2026-06-10T11:00:00.000Z");
    const snap = snapshot({
      consistencyStatus: "BLOCKED",
      autoFixActions: ["decision_log_backfill", "journal_backfill"],
    });
    assert.equal(
      shouldSkipConsistencyAutoFixCooldown({
        snapshot: snap,
        fingerprint: fp,
        lastRun: {
          fingerprint: fp,
          appliedAt: "2026-06-10T10:57:00.000Z",
          applied: ["decision_log_backfill"],
          consistencyStatus: "BLOCKED",
        },
        nowMs: now,
      }),
      true,
    );
    assert.equal(
      shouldSkipConsistencyAutoFixCooldown({
        snapshot: snap,
        fingerprint: fp,
        lastRun: {
          fingerprint: fp,
          appliedAt: "2026-06-10T10:54:00.000Z",
          applied: ["decision_log_backfill"],
          consistencyStatus: "BLOCKED",
        },
        nowMs: now,
      }),
      false,
    );
  });

  it("runs again when recommended action set changes", () => {
    const snap = snapshot({
      consistencyStatus: "WARNING",
      autoFixActions: ["monitor_event_backfill"],
    });
    assert.equal(
      shouldSkipConsistencyAutoFixCooldown({
        snapshot: snap,
        fingerprint: "monitor_event_backfill",
        lastRun: {
          fingerprint: "decision_log_backfill",
          appliedAt: new Date().toISOString(),
          applied: ["decision_log_backfill"],
          consistencyStatus: "WARNING",
        },
      }),
      false,
    );
  });
});
