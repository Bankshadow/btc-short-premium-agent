import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkSafetyGates } from "./check-safety-gates";
import { buildActionQueue } from "./build-action-queue";
import { buildRiskSummary } from "./build-risk-summary";
import { resolveDeskManagerActionPure } from "./resolve-action";
import { DEFAULT_GOVERNANCE_STATE } from "@/lib/governance/governance-state";
import type { DeskManagerAction } from "./types";

describe("autonomous-desk-manager", () => {
  it("blocks cycle when analysis paused", () => {
    const gates = checkSafetyGates({
      governance: { ...DEFAULT_GOVERNANCE_STATE, pauseAnalysis: true },
    });
    assert.equal(gates.allowed, false);
    assert.ok(gates.blockReason?.includes("paused"));
  });

  it("allows cycle with safety notices", () => {
    const gates = checkSafetyGates({
      governance: DEFAULT_GOVERNANCE_STATE,
    });
    assert.equal(gates.allowed, true);
    assert.ok(gates.notices.some((n) => n.includes("cannot place live trades")));
  });

  it("builds action queue with briefing and no-action fallback", () => {
    const actions = buildActionQueue({
      runId: "mgr-test-1",
      cycleType: "operational",
      risk: buildRiskSummary({ governance: DEFAULT_GOVERNANCE_STATE }),
    });
    assert.ok(actions.some((a) => a.type === "SEND_BRIEFING"));
    assert.ok(actions.some((a) => a.type === "NO_ACTION"));
    assert.equal(actions.every((a) => a.requiresApproval), true);
  });

  it("escalates risk when hard rules locked", () => {
    const risk = buildRiskSummary({
      governance: DEFAULT_GOVERNANCE_STATE,
      hardRules: {
        locked: true,
        activeRules: ["daily_loss_cap"],
        forcedVerdict: "SKIP",
        messages: ["Cap hit"],
      },
    });
    assert.equal(risk.escalationLevel, "CRITICAL");
    const actions = buildActionQueue({
      runId: "mgr-test-2",
      cycleType: "operational",
      risk,
    });
    assert.ok(actions.some((a) => a.type === "ESCALATE_RISK"));
  });

  it("resolves action in queue", () => {
    const queue: DeskManagerAction[] = [
      {
        actionId: "a1",
        type: "REVIEW_TRADE",
        priority: "MEDIUM",
        reason: "test",
        evidence: [],
        linkedTrades: [],
        linkedAgents: [],
        linkedProposals: [],
        status: "PENDING",
        requiresApproval: true,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        runId: "r1",
      },
    ];
    const { queue: next, action } = resolveDeskManagerActionPure(
      queue,
      "a1",
      "RESOLVED",
    );
    assert.ok(action);
    assert.equal(action.status, "RESOLVED");
    assert.equal(next[0].status, "RESOLVED");
  });
});
