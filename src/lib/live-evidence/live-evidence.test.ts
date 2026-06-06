import assert from "node:assert/strict";
import test from "node:test";
import { buildLiveEvidenceReport, formatLiveEvidenceReport } from "./build-live-evidence-report";
import type { LiveEvidenceBuildInput } from "./types";

function baseInput(): LiveEvidenceBuildInput {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    paper: {
      sampleSize: 10,
      winRate: 62,
      averageR: 0.35,
      totalPnl: 8.2,
    },
    testnet: {
      closedTrades: 8,
      learningRecords: 8,
      learnedRecords: 5,
      winRate: 58,
      mismatches: 0,
    },
    execution: {
      failedLiveTrades: 0,
      criticalExecutionIncidents: 0,
      warningExecutionIncidents: 0,
      averageSlippageBps: 4,
      rejectionRatePct: 0,
      failedCloseRatePct: 0,
      averageLatencyMs: 1200,
      duplicateSubmissionCount: 0,
      retryCountTotal: 0,
      gateStatus: "PASS",
      gateReasons: [],
    },
    riskControl: {
      riskStatus: "SAFE",
      blockNewTrades: false,
      triggeredLimits: [],
      riskReplayReviewedAt: "2026-01-01T00:00:00.000Z",
    },
    incidents: {
      openCount: 0,
      warningOpenCount: 0,
      criticalOpenCount: 0,
    },
    alerts: {
      anyChannelConfigured: true,
      recentDeliveryFailures: 0,
      lastDeliveryAt: "2026-01-01T00:00:00.000Z",
    },
    ledger: {
      healthy: true,
      entryCount: 100,
      brokenLinks: 0,
      missingHashes: 0,
      orphanTrades: 0,
      issues: [],
      lastSyncedAt: "2026-01-01T00:00:00.000Z",
    },
    operatorApproval: {
      doubleConfirmRequired: true,
      pendingApprovalActions: 1,
    },
    strategyHealth: {
      healthScorePct: 82,
      totalStrategies: 4,
      healthyStrategies: 3,
      reviewRequiredCount: 0,
      pausedCount: 0,
      candidateForLiveCount: 1,
    },
    exchange: {
      configured: true,
      connected: true,
      network: "testnet",
      error: null,
      clockSkewMs: 200,
    },
    endpointLock: {
      lockedCorrectly: true,
      detail: "ok",
    },
  };
}

test("buildLiveEvidenceReport returns ready state when all gates pass", () => {
  const report = buildLiveEvidenceReport(baseInput());
  assert.equal(report.readyForMicroLivePilot, true);
  assert.equal(report.hardBlockersTriggered.length, 0);
  assert.ok(report.readinessScore >= 80);
  assert.equal(report.categories.length, 10);
});

test("buildLiveEvidenceReport triggers required hard blockers", () => {
  const input = baseInput();
  input.testnet.closedTrades = 0;
  input.testnet.learningRecords = 0;
  input.testnet.learnedRecords = 0;
  input.incidents.criticalOpenCount = 1;
  input.alerts.anyChannelConfigured = false;
  input.ledger.healthy = false;
  input.strategyHealth.healthScorePct = 20;
  input.riskControl.riskReplayReviewedAt = null;
  input.operatorApproval.doubleConfirmRequired = false;
  input.endpointLock.lockedCorrectly = false;
  input.endpointLock.detail = "bad lock";
  input.execution.gateStatus = "FAIL";
  input.execution.gateReasons = ["rejection spike"];

  const report = buildLiveEvidenceReport(input);
  assert.equal(report.readyForMicroLivePilot, false);
  assert.ok(report.hardBlockersTriggered.length >= 9);
  assert.ok(
    report.hardBlockersTriggered.some((b) => b.key === "no_testnet_closed_trades"),
  );
  assert.ok(report.hardBlockersTriggered.some((b) => b.key === "alert_off"));
  assert.ok(
    report.hardBlockersTriggered.some((b) => b.key === "live_endpoint_not_locked_correctly"),
  );
  assert.ok(
    report.hardBlockersTriggered.some((b) => b.key === "execution_quality_degraded"),
  );
});

test("formatLiveEvidenceReport returns markdown and json", () => {
  const report = buildLiveEvidenceReport(baseInput());
  const exported = formatLiveEvidenceReport(report);
  assert.ok(exported.markdown.includes("Live Readiness Evidence Pack"));
  assert.equal(exported.json.readinessScore, report.readinessScore);
});
