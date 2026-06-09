import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { operatorActionDedupeKey } from "./dedupe-key";
import type { OperatorAction } from "./types";

function sample(partial: Partial<OperatorAction>): OperatorAction {
  return {
    actionId: partial.actionId ?? "test",
    type: partial.type ?? "RUN_ANALYSIS",
    priority: partial.priority ?? "HIGH",
    title: partial.title ?? "Run first desk cycle",
    description: partial.description ?? "desc",
    reason: partial.reason ?? "reason",
    linkedDecisionLogId: partial.linkedDecisionLogId ?? null,
    linkedTradeId: partial.linkedTradeId ?? null,
    linkedModule: partial.linkedModule ?? "autopilot",
    requiresHumanApproval: partial.requiresHumanApproval ?? false,
    status: partial.status ?? "OPEN",
    createdAt: partial.createdAt ?? new Date().toISOString(),
  };
}

describe("Operator action dedupe key", () => {
  it("dedupes automation failures by job type", () => {
    const a = sample({
      actionId: "acp-fail-DESK_ANALYZE-run-1",
      type: "REVIEW_RISK_BLOCKER",
      title: "Automation job failed: DESK_ANALYZE",
      linkedModule: "automation-control-plane",
    });
    const b = sample({
      actionId: "acp-fail-DESK_ANALYZE-run-2",
      type: "REVIEW_RISK_BLOCKER",
      title: "Automation job failed: DESK_ANALYZE",
      linkedModule: "automation-control-plane",
    });
    assert.equal(operatorActionDedupeKey(a), operatorActionDedupeKey(b));
  });

  it("dedupes resolve outcome by decision log id", () => {
    const a = sample({
      type: "RESOLVE_OUTCOME",
      linkedDecisionLogId: "log-123",
      linkedModule: "journal",
      title: "Resolve pending outcome",
    });
    const b = sample({
      actionId: "other-id",
      type: "RESOLVE_OUTCOME",
      linkedDecisionLogId: "log-123",
      linkedModule: "journal",
      title: "Resolve pending outcome",
    });
    assert.equal(operatorActionDedupeKey(a), operatorActionDedupeKey(b));
  });
});
