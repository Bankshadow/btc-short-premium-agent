import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GOAL_MIN_TRADES_FOR_TRUST } from "@/lib/goal-engine/types";
import { emptyEvidenceProgress } from "@/lib/evidence-progress";
import { emptyEvidenceQualitySnapshot } from "@/lib/evidence-quality/build-evidence-quality";
import { emptyIntegratedRiskBudget } from "@/lib/integrated-risk-budget/empty-snapshot";
import { emptyIntegratedStrategyHealth } from "@/lib/integrated-strategy-health/empty-snapshot";
import { emptyMicroLiveReadiness } from "@/lib/micro-live-readiness/empty-snapshot";
import { emptyMonitorReliabilitySnapshot } from "@/lib/monitor-reliability/empty-snapshot";
import { buildReadinessReviewChecklist, resolveReadinessReviewStatus } from "./build-readiness-review-checklist";
import { buildMicroLiveReadinessReviewFromSnapshots } from "./build-micro-live-readiness-review";
import { emptyMicroLiveReadinessReview } from "./empty-snapshot";

function baseInput(overrides: Partial<Parameters<typeof buildReadinessReviewChecklist>[0]> = {}) {
  return {
    connected: true,
    testnetConfigured: true,
    liveExecutionEnabled: false,
    liveBlocked: true,
    requireDoubleConfirm: true,
    killSwitchConfigured: true,
    killSwitchPaused: false,
    criticalIncidentOpen: false,
    criticalIncidentTitle: null,
    evidenceValidCount: GOAL_MIN_TRADES_FOR_TRUST,
    evidenceMissingDecisionLogId: 0,
    evidenceMissingCloseJournal: 0,
    evidenceMissingPnl: 0,
    evidenceQualityPassed: true,
    evidenceQualityBlockReason: null,
    strategyHealthStatus: "CONTINUE",
    strategyBlocksEntries: false,
    monitorHealthOk: true,
    monitorPositionUncertain: false,
    monitorCurrentIssue: null,
    riskBudgetConfigured: true,
    dailyLossLimitConfigured: true,
    reduceOnlyCloseTested: true,
    auditTrailComplete: true,
    telegramOrOperatorReady: true,
    learningPendingCount: 0,
    ...overrides,
  };
}

describe("micro-live readiness review mvp94", () => {
  it("empty snapshot cannot enable live", () => {
    const snap = emptyMicroLiveReadinessReview();
    assert.equal(snap.cannotEnableLive, true);
    assert.equal(snap.cannotPlaceLiveOrders, true);
    assert.equal(snap.liveTradingLocked, true);
    assert.equal(snap.checklist.length, 13);
  });

  it("BLOCKED when live execution enabled", () => {
    const checklist = buildReadinessReviewChecklist(
      baseInput({ liveExecutionEnabled: true, liveBlocked: false }),
    );
    const status = resolveReadinessReviewStatus({
      checklist,
      liveExecutionEnabled: true,
      liveBlocked: false,
      criticalIncidentOpen: false,
    });
    assert.equal(status, "BLOCKED");
  });

  it("NOT_READY when fewer than 12 valid trades", () => {
    const review = buildMicroLiveReadinessReviewFromSnapshots({
      connected: true,
      testnetConfigured: true,
      evidenceProgress: {
        ...emptyEvidenceProgress(),
        validTrades: [],
        missingDecisionLogId: 0,
        missingCloseJournal: 0,
        missingPnl: 0,
      },
      evidenceQuality: emptyEvidenceQualitySnapshot(),
      integratedStrategyHealth: emptyIntegratedStrategyHealth(),
      integratedRiskBudget: emptyIntegratedRiskBudget(),
      monitorReliability: emptyMonitorReliabilitySnapshot(),
      microLiveReadiness: emptyMicroLiveReadiness(),
    });
    assert.equal(review.readinessStatus, "NOT_READY");
    assert.ok(review.blockers.some((b) => /12|valid/i.test(b)));
  });

  it("READY_FOR_REVIEW when all checklist inputs pass", () => {
    const checklist = buildReadinessReviewChecklist(baseInput());
    const status = resolveReadinessReviewStatus({
      checklist,
      liveExecutionEnabled: false,
      liveBlocked: true,
      criticalIncidentOpen: false,
    });
    assert.equal(status, "READY_FOR_REVIEW");
    assert.equal(checklist.length, 13);
    assert.ok(checklist.every((c) => c.passed));
  });
});
