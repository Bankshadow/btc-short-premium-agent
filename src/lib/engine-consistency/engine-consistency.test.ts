import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveConsistencyStatus } from "./resolve-consistency-status";
import type { ConsistencyIssue } from "./types";

function mockIssue(
  partial: Pick<ConsistencyIssue, "kind" | "severity" | "message"> &
    Partial<ConsistencyIssue>,
): ConsistencyIssue {
  return {
    id: `test-${partial.kind}`,
    source: "test",
    relatedId: null,
    autoFixId: null,
    requiredManualAction: null,
    ...partial,
  };
}

describe("engine consistency mvp88", () => {
  it("resolves OK when no issues", () => {
    const r = resolveConsistencyStatus([], false);
    assert.equal(r.consistencyStatus, "OK");
    assert.equal(r.blocksNewTrades, false);
  });

  it("blocks trades when position state uncertain", () => {
    const r = resolveConsistencyStatus(
      [
        mockIssue({
          kind: "binance_position_not_in_journal",
          severity: "BLOCKED",
          message: "orphan position",
        }),
      ],
      true,
    );
    assert.equal(r.consistencyStatus, "BLOCKED");
    assert.equal(r.blocksNewTrades, true);
  });

  it("warns on missing learning without blocking trades", () => {
    const r = resolveConsistencyStatus(
      [
        mockIssue({
          kind: "learning_record_missing_after_closed",
          severity: "WARNING",
          message: "missing learning",
        }),
      ],
      false,
    );
    assert.equal(r.consistencyStatus, "WARNING");
    assert.equal(r.blocksNewTrades, false);
  });
});
