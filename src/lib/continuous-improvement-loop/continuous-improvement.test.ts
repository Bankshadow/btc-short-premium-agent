import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";
import { detectImprovementIssues } from "./detect-issues";
import { reviewIssueWithCommittee } from "./committee-review";
import { buildImprovementProposal } from "./build-proposal";
import { generateImprovementCursorPrompt } from "./generate-cursor-prompt";
import { resetImprovementStoreForTests } from "./improvement-store";

function mission(patch: Partial<MissionFlowSnapshot> = {}): MissionFlowSnapshot {
  return {
    startCapital: 1000,
    targetCapital: 10000,
    currentEquity: 1000,
    progressPct: 0,
    remainingToTarget: 9000,
    netPnl: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalTrades: 0,
    openTrades: 0,
    closedTrades: 3,
    wins: 1,
    losses: 2,
    breakeven: 0,
    winRate: 33,
    maxDrawdown: 0,
    currentPosition: null,
    pendingTestnetPreview: null,
    aiStatus: {
      state: "MONITORING",
      lastAction: "idle",
      nextAction: "Continue",
      humanActionRequired: false,
    },
    binanceTestnet: { status: "DISCONNECTED", reason: "missing keys", proxyProvider: null },
    lastUpdatedAt: new Date().toISOString(),
    lastCycleAt: new Date().toISOString(),
    lastVerdict: "SKIP",
    latestDecisionLogId: null,
    lastDeskRunId: null,
    risk: { liveLocked: true, testnetStatus: "ok", blocker: null },
    trust: { completedTrades: 3, minRequired: 10, ready: false },
    nextRecommendation: "Connect testnet",
    scopeLabel: "TESTNET",
    enginesNeedingAttention: 2,
    learnedTrades: 1,
    pendingLearningReview: 0,
    learningPending: [],
    automation: {
      enabled: true,
      paused: false,
      intervalMinutes: 15,
      lastRunAt: null,
      nextRunAt: null,
      lastRunStatus: null,
      lastTrigger: null,
      autoExecuteEnabled: false,
      autoLearnEnabled: true,
    },
    notifications: {
      telegramConfigured: false,
      notifyOnTrade: true,
      notifyOnBlocker: true,
      lastAlertAt: null,
    },
    recentActivity: [],
    learningInsights: {
      learnedCount: 1,
      winCount: 1,
      lossCount: 2,
      avgR: null,
      recent: [],
    },
    strategyHealth: {
      strategyId: "s1",
      label: "AI signal",
      status: "CAUTION",
      recommendation: "PAUSE",
      winRate: 30,
      sampleSize: 3,
      healthScorePct: 40,
      tradeAllowed: false,
      blockReason: "Win rate below threshold",
    },
    trustNotionalUsd: 100,
    selfLearning: { serverEvaluated: 0, lastTopAgent: null, lastEvaluatedAt: null },
    ...patch,
  };
}

describe("Continuous improvement loop (MVP 87)", () => {
  beforeEach(async () => {
    await resetImprovementStoreForTests();
  });

  it("detects testnet, data, strategy, and report issues", () => {
    const issues = detectImprovementIssues({
      mission: mission(),
      dataTrustGrade: "D",
      dailyReviewMissing: true,
    });
    assert.ok(issues.some((i) => i.issueType === "TESTNET_FAILURE"));
    assert.ok(issues.some((i) => i.issueType === "DATA_NOT_FLOWING"));
    assert.ok(issues.some((i) => i.issueType === "STRATEGY_WEAKNESS"));
    assert.ok(issues.some((i) => i.issueType === "REPORT_MISSING"));
  });

  it("committee reviews and builds proposal with cursor prompt", () => {
    const issues = detectImprovementIssues({
      mission: mission({ risk: { liveLocked: true, testnetStatus: "ok", blocker: "daily loss" } }),
    });
    const issue = issues.find((i) => i.issueType === "RISK_GAP");
    assert.ok(issue);
    const committee = reviewIssueWithCommittee(issue!);
    assert.ok(["APPROVE_PROPOSAL", "PAUSE_AND_REVIEW"].includes(committee.recommendation));
    const proposal = buildImprovementProposal({ issue: issue!, committee });
    assert.equal(proposal.cannotAutoMerge, true);
    assert.equal(proposal.cannotEnableLive, true);
    assert.equal(proposal.requiresHumanApproval, true);
    assert.ok(proposal.cursorPrompt.includes("Do NOT enable live trading"));
    assert.ok(proposal.cursorPrompt.includes(proposal.title));
    const prompt = generateImprovementCursorPrompt({ proposal, committee });
    assert.ok(prompt.includes("SAFETY CONSTRAINTS"));
  });
});
