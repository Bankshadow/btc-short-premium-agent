import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { moderateCommitteeResults } from "./committee-moderator";
import { assertParallelReviewOnly } from "./safety";
import { resetParallelTaskRunnerForTests } from "./runner-store";
import type { ParallelAgentReview } from "./types";

function review(
  partial: Partial<ParallelAgentReview> & Pick<ParallelAgentReview, "role" | "status" | "headline">,
): ParallelAgentReview {
  return {
    agentName: partial.role,
    findings: [],
    risks: [],
    recommendations: [],
    durationMs: 1,
    error: null,
    ...partial,
  };
}

describe("Parallel task runner (MVP 76)", () => {
  beforeEach(async () => {
    await resetParallelTaskRunnerForTests();
  });

  it("rejects parallel order execution intent", () => {
    assert.throws(
      () => assertParallelReviewOnly("execute testnet order now"),
      /parallel order execution is forbidden/,
    );
  });

  it("moderator pauses on critical risk review", () => {
    const committee = moderateCommitteeResults([
      review({
        role: "RISK",
        status: "CRITICAL",
        headline: "Risk blocked",
        findings: ["Daily loss limit"],
        recommendations: ["Clear blocker"],
      }),
      review({ role: "UX", status: "OK", headline: "UX ok" }),
    ]);
    assert.equal(committee.recommendation, "PAUSE_AND_REVIEW");
    assert.equal(committee.parallelOrderExecutionBlocked, true);
    assert.ok(committee.actionItems.length >= 1);
  });

  it("moderator continues when all agents OK", () => {
    const committee = moderateCommitteeResults([
      review({ role: "STRATEGY", status: "OK", headline: "OK" }),
      review({ role: "RISK", status: "OK", headline: "OK" }),
      review({ role: "UX", status: "OK", headline: "OK" }),
    ]);
    assert.equal(committee.recommendation, "CONTINUE");
    assert.equal(committee.executionSerialized, true);
  });

  it("includes cursor prompt when approved and strategist MVP present", () => {
    const committee = moderateCommitteeResults(
      [
        review({
          role: "PROJECT_STRATEGIST",
          status: "OK",
          headline: "Recommended MVP: Parallel runner polish",
          recommendations: ["Implement"],
        }),
        review({ role: "STRATEGY", status: "OK", headline: "OK" }),
      ],
      { approveCursorPrompt: true },
    );
    assert.equal(committee.recommendation, "IMPLEMENT_FOLLOW_UP");
    assert.ok(committee.cursorPrompt?.includes("Parallel runner polish"));
    assert.equal(committee.cursorPromptApproved, true);
  });
});
