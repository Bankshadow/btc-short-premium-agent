import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExecutionSafetyGateReport,
  deriveReportsGateStatus,
} from "@/lib/reports/execution-safety-report";
import type { OrderPreview } from "@/lib/execution/preview-types";
import type { ExecutionSafetyResult } from "@/lib/execution/execution-safety-types";

const basePreview: OrderPreview = {
  previewId: "prev-1",
  runId: "run-1",
  decisionLogId: "dl-1",
  symbol: "BTCUSDT",
  side: "SELL",
  notionalUsd: 50,
  estimatedQty: "0.001",
  orderType: "MARKET",
  environment: "TESTNET",
  status: "ACTIVE",
  expiresAt: new Date(Date.now() + 900_000).toISOString(),
  createdAt: new Date().toISOString(),
  blocked: false,
  blockReasons: [],
  requiresDoubleConfirm: true,
};

const blockedReview: ExecutionSafetyResult = {
  allowed: false,
  blocked: true,
  requiresDoubleConfirm: true,
  doubleConfirmProvided: false,
  blockers: [
    {
      code: "DOUBLE_CONFIRM_REQUIRED",
      severity: "HARD_BLOCK",
      message: "Double confirmation required.",
      requiredAction: "Check confirmation box.",
    },
  ],
  warnings: [],
  previewId: "prev-1",
  runId: "run-1",
  decisionLogId: "dl-1",
  environment: "TESTNET",
  reviewedAt: new Date().toISOString(),
  executionEnabled: false,
  message: "Resolve blockers before execution.",
};

const passedReview: ExecutionSafetyResult = {
  ...blockedReview,
  allowed: true,
  blocked: false,
  doubleConfirmProvided: true,
  blockers: [],
  message: "Execution gate passed.",
};

describe("reports execution safety gate", () => {
  it("NO_PREVIEW when no preview", () => {
    assert.equal(
      deriveReportsGateStatus({ preview: null, latestReview: null }),
      "NO_PREVIEW",
    );
  });

  it("READY_FOR_REVIEW when preview exists without review", () => {
    assert.equal(
      deriveReportsGateStatus({ preview: basePreview, latestReview: null }),
      "READY_FOR_REVIEW",
    );
  });

  it("BLOCKED when review has blockers", () => {
    assert.equal(
      deriveReportsGateStatus({ preview: basePreview, latestReview: blockedReview }),
      "BLOCKED",
    );
  });

  it("READY_FOR_EXECUTION_NEXT_MVP when gate passed with double confirm", () => {
    assert.equal(
      deriveReportsGateStatus({ preview: basePreview, latestReview: passedReview }),
      "READY_FOR_EXECUTION_NEXT_MVP",
    );
  });

  it("builds MVP 4 message when gate passes", () => {
    const report = buildExecutionSafetyGateReport({
      preview: basePreview,
      latestReview: passedReview,
      recentSafetyEvents: [],
    });
    assert.equal(report.status, "READY_FOR_EXECUTION_NEXT_MVP");
    assert.match(report.nextSafeAction, /MVP 4/);
    assert.equal(report.previewExpired, false);
    assert.equal(report.latestReviewMessage, passedReview.message);
  });
});
