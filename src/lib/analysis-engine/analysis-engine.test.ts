import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReportSummary,
  resolveFinalVerdictFromAnalysis,
  resolveConfidenceFromAnalysis,
} from "./analysis-result";
import { runAnalysisRiskGate } from "./analysis-risk-gate";
import { resolveAnalysisAiState, listAnalysisPipelineStages } from "./analysis-engine-registry";
import { toAnalysisUiView } from "./analysis-ui-adapter";
import { emptyCentralAnalysisState } from "./analysis-engine-storage";
import type { AnalysisContext } from "./analysis-state";
import type { AnalyzeApiResponse } from "@/lib/types/market";

function mockContext(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    runId: "ctx-test",
    environment: "TESTNET",
    builtAt: new Date().toISOString(),
    market: { spotPrice: 90000, regime: "RANGE", ivHvRatio: null, fundingRate: null },
    positions: [],
    trades: { openCount: 0, closedCount: 0 },
    decisionLog: [],
    journal: [],
    strategyRegistry: null,
    governance: null,
    validation: { killSwitchActive: false, blockers: [] },
    killSwitch: { active: false, reason: null },
    riskPolicy: { profile: "balanced", blockNewTrades: false, triggeredLimits: [] },
    learningRecords: [],
    agentScoreboard: { totalLearned: 0, topAgent: null },
    councilState: {
      weightedVerdict: "WAIT",
      confidence: 55,
      riskVeto: false,
      agentCount: 6,
    },
    simulationState: { available: false, lastRunAt: null },
    incidentState: { openCount: 0, criticalOpen: false, topTitle: null },
    missionSnapshot: null,
    testnetStatus: {
      connected: true,
      configured: true,
      autoExecuteEnabled: false,
      liveLocked: true,
      blocker: null,
    },
    advancedModules: [],
    consistency: null,
    ...overrides,
  };
}

function mockAnalysis(verdict = "WAIT"): AnalyzeApiResponse {
  return {
    step1_marketSnapshot: { spotPrice: 90000 } as AnalyzeApiResponse["step1_marketSnapshot"],
    step5_verdict: {
      recommendation: verdict,
      confidence: 62,
      summary: "Test summary",
      risks: [],
      caution: false,
      missingData: [],
      analyzedAt: new Date().toISOString(),
    },
    tradingDesk: {
      weightedCommittee: {
        weightedVerdict: verdict,
        originalVerdict: verdict,
        verdictDiffers: false,
        explanation: "Committee explanation",
        tradeScore: 62,
        skipScore: 20,
        waitScore: 18,
        confidenceAdjustment: 0,
        disagreementScore: 0,
        reasonTrail: [],
        hardGatesApplied: [],
        weightProfile: "balanced",
        advisoryOnly: true,
        cannotEnableLive: true,
      },
    } as AnalyzeApiResponse["tradingDesk"],
  } as AnalyzeApiResponse;
}

describe("central analysis engine mvp83", () => {
  it("lists twelve pipeline stages in order", () => {
    const stages = listAnalysisPipelineStages();
    assert.equal(stages.length, 12);
    assert.equal(stages[0].id, "build_context");
    assert.equal(stages[11].id, "ai_status");
  });

  it("resolves verdict, confidence, and risk gate blockers", () => {
    const analysis = mockAnalysis("TRADE");
    assert.equal(resolveFinalVerdictFromAnalysis(analysis), "TRADE");
    assert.equal(resolveConfidenceFromAnalysis(analysis), 62);

    const gate = runAnalysisRiskGate({
      context: mockContext({
        killSwitch: { active: true, reason: "Daily loss limit" },
      }),
      analysis,
      finalVerdict: "TRADE",
    });
    assert.equal(gate.riskStatus, "BLOCKED");
    assert.ok(gate.blockers.some((b) => b.includes("Daily loss")));
    assert.equal(gate.humanActionRequired, true);
  });

  it("builds ui view with runId and decisionLogId from latest result", () => {
    const state = emptyCentralAnalysisState();
    state.latestRunId = "cae-1";
    state.latestDecisionLogId = "dl-1";

    const ui = toAnalysisUiView({
      state,
      result: {
        runId: "cae-1",
        decisionLogId: "dl-1",
        generatedAt: new Date().toISOString(),
        finalVerdict: "WAIT",
        confidence: 50,
        tradeCandidate: null,
        riskStatus: "SAFE",
        blockers: [],
        reasons: ["Wait"],
        nextAction: "Monitor",
        humanActionRequired: false,
        aiState: "WAITING",
        missionImpact: { progressPct: 10, evidenceCompleted: 1, pendingLearning: 0 },
        reportSummary: buildReportSummary({
          finalVerdict: "WAIT",
          confidence: 50,
          blockers: [],
          reasons: ["Wait"],
        }),
        learningImpact: { pendingReviewCount: 0, learnedCount: 0, headline: null },
        auditEvents: [],
        liveTradingLocked: true,
        autoExecuteBlocked: true,
      },
    });

    assert.equal(ui.runId, "cae-1");
    assert.equal(ui.decisionLogId, "dl-1");
    assert.equal(ui.liveTradingLocked, true);
    assert.equal(
      resolveAnalysisAiState({
        result: {
          finalVerdict: "WAIT",
          blockers: [],
          humanActionRequired: false,
        },
        context: null,
      }),
      "WAITING",
    );
  });
});
