import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { runAnalysis } from "@/lib/analysis/analysis-runner";
import { compareVerdictWithSwarm, loadScenarioContext } from "@/lib/analysis/scenario-context";
import { computeBaseVerdict } from "@/lib/analysis/scenario-aware-analysis";
import { recalculateAgentScoreboard } from "@/lib/agents/agent-scoreboard";
import { runCollaborationLoop } from "@/lib/collaboration/collaboration-runner";
import { classifyRegime } from "@/lib/regime/regime-classifier";
import { retrieveRegimeMemory } from "@/lib/regime/regime-retrieval";
import { evaluateNoTradeRules } from "@/lib/rules/no-trade-rule-engine";
import { runRuleEvaluation } from "@/lib/rules/rule-evaluator";
import { generateImprovementProposals, getAllImprovementProposals } from "@/lib/improvement/proposal-generator";
import { approveImprovement } from "@/lib/improvement/approval-flow";
import {
  createStrategyVersionManual,
  ensureBaselineStrategyVersion,
} from "@/lib/versioning/change-control";
import { getStrategyVersionSnapshot } from "@/lib/versioning/strategy-version-store";
import { runMirofishSwarm } from "@/lib/skills/mirofish-swarm/swarm-runner";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { isLiveEnabled } from "@/lib/risk/risk-gate";

describe("MVP 12-18 loops", () => {
  let tmpDir: string;
  let prevDir: string | undefined;
  let prevTestnet: string | undefined;
  let prevMock: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-mvp12-"));
    prevDir = process.env.JOURNAL_DATA_DIR;
    prevTestnet = process.env.BINANCE_TESTNET_ENABLED;
    prevMock = process.env.V2_MVP2_MOCK_TRADE;
    process.env.JOURNAL_DATA_DIR = tmpDir;
    process.env.BINANCE_LIVE_ENABLED = "false";
    process.env.BINANCE_TESTNET_ENABLED = "true";
    process.env.V2_MVP2_MOCK_TRADE = "true";
  });

  afterEach(() => {
    if (prevDir !== undefined) process.env.JOURNAL_DATA_DIR = prevDir;
    else delete process.env.JOURNAL_DATA_DIR;
    if (prevTestnet !== undefined) process.env.BINANCE_TESTNET_ENABLED = prevTestnet;
    else delete process.env.BINANCE_TESTNET_ENABLED;
    if (prevMock !== undefined) process.env.V2_MVP2_MOCK_TRADE = prevMock;
    else delete process.env.V2_MVP2_MOCK_TRADE;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("analysis works with no swarm report", async () => {
    const result = await runAnalysis();
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "ANALYSIS_STARTED"));
    assert.ok(events.some((e) => e.type === "VERDICT_CREATED"));
    assert.ok(events.some((e) => e.type === "ANALYSIS_WITH_SCENARIO_COMPLETED"));
    assert.equal(result.verdict.verdict, "TRADE");
  });

  it("analysis uses swarm report if available", async () => {
    await runMirofishSwarm();
    const result = await runAnalysis();
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "SCENARIO_CONTEXT_INJECTED"));
    assert.ok(result.scenarioContext);
    assert.ok(result.scenarioNote);
  });

  it("bullish swarm cannot force trade when base is WAIT", () => {
    process.env.V2_MVP2_MOCK_TRADE = "false";
    const base = computeBaseVerdict([]);
    assert.equal(base.verdict, "WAIT");
    const cmp = compareVerdictWithSwarm("WAIT", {
      reportId: "r1",
      runId: "run1",
      advisorySignal: "BULLISH",
      recommendedAction: "ALLOW_ANALYSIS",
      likelyScenario: "Upside",
      confidence: 0.9,
      safetyNote: "Advisory only",
      injectedAt: new Date().toISOString(),
    });
    assert.equal(cmp.agreement, "DISAGREE");
  });

  it("risk gate can block swarm-aligned trade via rules", async () => {
    for (let i = 0; i < 3; i++) {
      await appendEvent({
        type: "PNL_REALIZED",
        environment: "testnet",
        tradeId: `t${i}`,
        payload: { result: "LOSS", netPnl: -10 },
      });
    }
    const rules = await evaluateNoTradeRules({
      proposedVerdict: "TRADE",
      swarmAgreement: "AGREE",
      regime: "UNKNOWN",
    });
    const consecutive = rules.triggered.find((t) => t.code === "CONSECUTIVE_LOSSES");
    assert.ok(consecutive);
    assert.equal(consecutive?.severity, "WARN");
  });

  it("REPEATED_SETUP_FAILURE is advisory during evidence collection", async () => {
    for (let i = 0; i < 2; i++) {
      await appendEvent({
        type: "PNL_REALIZED",
        environment: "testnet",
        tradeId: `loss-${i}`,
        payload: { result: "LOSS", netPnl: -1, qty: "0.001", entryPrice: 100000, exitPrice: 99000 },
      });
    }
    const rules = await evaluateNoTradeRules({
      proposedVerdict: "TRADE",
      swarmAgreement: "AGREE",
      regime: "UNKNOWN",
    });
    assert.equal(rules.blocked, false);
    const repeated = rules.triggered.find((t) => t.code === "REPEATED_SETUP_FAILURE");
    assert.ok(repeated);
    assert.equal(repeated?.severity, "WARN");
  });

  it("REPEATED_SETUP_FAILURE counts consecutive losses only", async () => {
    await appendEvent({
      type: "PNL_REALIZED",
      environment: "testnet",
      tradeId: "win-1",
      payload: { result: "WIN", netPnl: 1 },
    });
    await appendEvent({
      type: "PNL_REALIZED",
      environment: "testnet",
      tradeId: "loss-1",
      payload: { result: "LOSS", netPnl: -1 },
    });
    const rules = await evaluateNoTradeRules({
      proposedVerdict: "TRADE",
      swarmAgreement: "AGREE",
      regime: "UNKNOWN",
    });
    assert.ok(!rules.triggered.some((t) => t.code === "REPEATED_SETUP_FAILURE"));
  });

  it("classify regime", () => {
    const mission = buildMissionSnapshot([]);
    const r = classifyRegime({ mission, swarmReport: null });
    assert.equal(r.regime, "UNKNOWN");
  });

  it("retrieve similar trades", async () => {
    const memory = await retrieveRegimeMemory();
    assert.ok(memory.similarTrades);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "REGIME_MEMORY_RETRIEVED"));
  });

  it("unknown regime handled", async () => {
    const rules = await runRuleEvaluation({
      runId: "run1",
      decisionLogId: "dl1",
      proposedVerdict: "TRADE",
      swarmAgreement: "NO_SCENARIO",
      regime: "UNKNOWN",
    });
    assert.ok(rules.triggered.some((t) => t.code === "REGIME_UNKNOWN_HIGH_VOL"));
  });

  it("collaboration creates proposal critique consensus", async () => {
    const summary = await runCollaborationLoop("run-collab");
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "AGENT_PROPOSAL_CREATED"));
    assert.ok(events.some((e) => e.type === "AGENT_CRITIQUE_CREATED"));
    assert.ok(events.some((e) => e.type === "AGENT_CONSENSUS_CREATED"));
    assert.ok(summary.dissentingViews.length >= 0);
    assert.equal(summary.advisoryOnly, true);
  });

  it("proposal generated from repeated loss requires evidence", async () => {
    await appendEvent({
      type: "PNL_REALIZED",
      environment: "testnet",
      tradeId: "t-loss-1",
      payload: { result: "LOSS", netPnl: -5 },
    });
    await appendEvent({
      type: "PNL_REALIZED",
      environment: "testnet",
      tradeId: "t-loss-2",
      payload: { result: "LOSS", netPnl: -5 },
    });
    const created = await generateImprovementProposals();
    assert.ok(created.length >= 1);
    assert.ok(created[0].evidence.length > 0);
  });

  it("approve and reject write events", async () => {
    await appendEvent({
      type: "IMPROVEMENT_PROPOSAL_CREATED",
      environment: "testnet",
      payload: {
        improvementId: "imp-test-1",
        type: "ADD_NO_TRADE_RULE",
        title: "Test",
        description: "Test",
        evidence: ["loss on t1"],
        tradeIds: ["t1"],
        status: "PENDING",
        createdAt: new Date().toISOString(),
        decidedAt: null,
        decidedBy: null,
      },
    });
    const approved = await approveImprovement("imp-test-1");
    assert.equal(approved.ok, true);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "IMPROVEMENT_APPROVED"));
    assert.ok(events.some((e) => e.type === "STRATEGY_VERSION_CREATED"));
  });

  it("create strategy version and link baseline", async () => {
    const baseline = await ensureBaselineStrategyVersion();
    assert.ok(baseline.versionId);
    const version = await createStrategyVersionManual({
      label: "Test version",
      changelog: ["test change"],
      createdBy: "test",
    });
    const snap = await getStrategyVersionSnapshot();
    assert.ok(snap.versions.some((v) => v.versionId === version.versionId));
  });

  it("agent scoreboard advisory only", async () => {
    const board = await recalculateAgentScoreboard();
    assert.equal(board.advisoryOnly, true);
    assert.equal(board.liveLocked, true);
  });

  it("no order created from collaboration", async () => {
    await runCollaborationLoop();
    const events = await getEvents();
    assert.equal(events.some((e) => e.type === "ORDER_EXECUTED"), false);
    assert.equal(events.some((e) => e.type === "PREVIEW_CREATED"), false);
  });

  it("live trading remains locked", () => {
    assert.equal(isLiveEnabled(), false);
  });
});
