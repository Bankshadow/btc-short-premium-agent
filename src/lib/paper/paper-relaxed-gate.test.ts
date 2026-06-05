import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { TradingDeskOutput } from "@/lib/agents/types";
import {
  evaluatePaperOpenEligibility,
  relaxedPaperBlocksLiveExecution,
} from "./paper-relaxed-gate";
import { buildPaperOrderFromEligibility } from "./paper-execution";
import { DEFAULT_PAPER_SETTINGS } from "./paper-order-types";

function baseDesk(overrides: Partial<TradingDeskOutput> = {}): TradingDeskOutput {
  return {
    analyzedAt: new Date().toISOString(),
    marketRegime: "range",
    research: {} as TradingDeskOutput["research"],
    deskMemory: { bullets: [], pinnedCount: 0, draftRuleCount: 0, agent: {} as never },
    agents: [
      {
        agentName: "Options Strategy Agent",
        recommendation: "TRADE",
        strategyType: "OPTIONS",
        confidence: "MEDIUM",
        marketView: "premium",
        reasons: ["IV ok"],
        risks: [],
        proposedAction: "sell call",
        missingData: [],
      },
    ],
    bullThesis: {} as never,
    bearThesis: {} as never,
    riskManager: {
      agentName: "Risk Manager Agent",
      recommendation: "TRADE",
      strategyType: "RISK",
      confidence: "HIGH",
      marketView: "ok",
      reasons: [],
      risks: [],
      proposedAction: "ok",
      missingData: [],
      veto: false,
    },
    committee: {
      finalVerdict: "WAIT",
      consensusSummary: "wait",
      riskVeto: false,
      topReasons: [],
      finalActionPlan: "wait",
      agreementNotes: [],
      disagreementNotes: [],
    },
    debate: [],
    disclaimer: "paper",
    ...overrides,
  };
}

function mockAnalyze(
  patch: Partial<AnalyzeApiResponse> & {
    committeeVerdict?: "TRADE" | "WAIT" | "SKIP";
    playbookRec?: "trade" | "wait" | "skip";
    confidence?: number;
    riskVeto?: boolean;
  } = {},
): AnalyzeApiResponse {
  const committeeVerdict = patch.committeeVerdict ?? "WAIT";
  const playbookRec = patch.playbookRec ?? "wait";
  const confidence = patch.confidence ?? 55;

  const desk = baseDesk({
    committee: {
      finalVerdict: committeeVerdict,
      consensusSummary: "",
      riskVeto: patch.riskVeto ?? false,
      topReasons: [],
      finalActionPlan: "",
      agreementNotes: [],
      disagreementNotes: [],
    },
    riskManager: {
      agentName: "Risk Manager Agent",
      recommendation: patch.riskVeto ? "SKIP" : "TRADE",
      strategyType: "RISK",
      confidence: "HIGH",
      marketView: "",
      reasons: [],
      risks: [],
      proposedAction: "",
      missingData: [],
      veto: patch.riskVeto ?? false,
      vetoReasons: patch.riskVeto ? ["test veto"] : undefined,
    },
  });

  return {
    step1_marketSnapshot: {
      symbol: "BTCUSDT",
      spotPrice: 90_000,
      timestamp: new Date().toISOString(),
      hv30: 0.5,
      iv: 0.6,
      ivHvRatio: 1.2,
      ivRank: 50,
      ivPercentile: 50,
      fundingRate: 0.0001,
      openInterestBtc: 100,
      oiChange24hPct: 0,
      oiChange1hPct: 0,
      volume24hBtc: 100,
      volumeChange24hPct: 0,
      priceChange24hPct: 0,
    },
    step2_eightCheckFramework: [],
    step3_noTradeRules: [
      {
        id: "macro-event",
        name: "Macro",
        severity: "hard",
        triggered: false,
        message: "ok",
      },
      {
        id: "liquidation-cascade",
        name: "Liq",
        severity: "hard",
        triggered: false,
        message: "ok",
      },
    ],
    step4_combinationRead: {} as never,
    step5_verdict: {
      recommendation: playbookRec,
      confidence,
      summary: "test",
      risks: [],
      caution: false,
      missingData: [],
      analyzedAt: new Date().toISOString(),
      candidate: {
        symbol: "BTCUSDT",
        strike: 95_000,
        markPrice: 1000,
        delta: 0.14,
        sdDistance: 2,
        optionType: "call",
      } as never,
    },
    step6_actionPlan: {
      action: "sell_call",
      suggestedSizePct: 2,
      entryNotes: "test",
      exitNotes: "",
      slIndexPrice: 0,
      slMethod: "index_price",
      pinExitTimeTh: "",
      settlementTimeTh: "",
      targetPremiumCapturePct: 50,
      disclaimer: "",
    },
    optionCandidates: [],
    technical: { daily: {} as never, h4: {} as never, h1: {} as never },
    liquidation: { liquidation24h: null, source: "mock" },
    macroEvent: { hasEventBeforeSettlement: false },
    tradingDesk: desk,
    sourceErrors: [],
    marketSnapshot: {} as never,
    technicalSnapshot: {} as never,
    checks: [],
    noTradeRules: [],
    combinationRead: {} as never,
    verdict: {} as never,
    actionPlan: {} as never,
    dataTimestamp: new Date().toISOString(),
    dataSourceIssues: [],
    finalVerdict: committeeVerdict,
    dataTrust: {
      score: 70,
      grade: "MEDIUM",
      tradeAllowed: false,
      criticalIssues: [],
      warnings: [],
    },
    preMortem: {
      preMortemId: "pm-1",
      failureScenarios: [],
      topFailureReason: "",
      riskAmplifiers: [],
      invalidationTriggers: [],
      mitigationPlan: [],
      preMortemVerdict: "PASS",
      confidence: "HIGH",
      generatedAt: new Date().toISOString(),
    },
    ...patch,
  } as AnalyzeApiResponse;
}

describe("paper relaxed gate", () => {
  it("relaxed mode cannot trigger live execution flag", () => {
    assert.equal(relaxedPaperBlocksLiveExecution("RELAXED_PAPER"), true);
    assert.equal(relaxedPaperBlocksLiveExecution("STRICT_PAPER"), false);
  });

  it("strict mode unchanged — requires committee TRADE", () => {
    const wait = evaluatePaperOpenEligibility(
      mockAnalyze({ committeeVerdict: "WAIT", playbookRec: "trade" }),
      { ...DEFAULT_PAPER_SETTINGS, paperMode: "STRICT_PAPER" },
    );
    assert.equal(wait.eligible, false);

    const trade = evaluatePaperOpenEligibility(
      mockAnalyze({ committeeVerdict: "TRADE", playbookRec: "trade" }),
      { ...DEFAULT_PAPER_SETTINGS, paperMode: "STRICT_PAPER" },
    );
    assert.equal(trade.eligible, true);
    assert.equal(trade.paperMode, "STRICT_PAPER");
  });

  it("relaxed mode respects hard risk veto", () => {
    const result = evaluatePaperOpenEligibility(
      mockAnalyze({ committeeVerdict: "TRADE", playbookRec: "trade", riskVeto: true }),
      { ...DEFAULT_PAPER_SETTINGS, paperMode: "RELAXED_PAPER" },
    );
    assert.equal(result.eligible, false);
    assert.equal(result.hardBlock, "RISK_VETO");
  });

  it("relaxed mode opens on playbook WAIT with confidence threshold", () => {
    const result = evaluatePaperOpenEligibility(
      mockAnalyze({
        committeeVerdict: "WAIT",
        playbookRec: "wait",
        confidence: 58,
      }),
      {
        ...DEFAULT_PAPER_SETTINGS,
        paperMode: "RELAXED_PAPER",
        relaxedMinConfidence: 52,
        relaxedAllowWaitToPaperTrade: true,
      },
    );
    assert.equal(result.eligible, true);
    assert.equal(result.paperMode, "RELAXED_PAPER");
    assert.ok(result.relaxedReason?.includes("WAIT"));
  });

  it("relaxed mode records metadata on built orders", () => {
    const data = mockAnalyze({
      committeeVerdict: "WAIT",
      playbookRec: "wait",
      confidence: 60,
    });
    const eligibility = evaluatePaperOpenEligibility(data, {
      ...DEFAULT_PAPER_SETTINGS,
      paperMode: "RELAXED_PAPER",
    });
    const order = buildPaperOrderFromEligibility(data, "log-1", eligibility);
    assert.ok(order);
    assert.equal(order?.paperMode, "RELAXED_PAPER");
    assert.equal(order?.strictVerdict, "WAIT");
    assert.equal(order?.relaxedVerdict, "TRADE");
    assert.ok(order?.relaxedReason);
    assert.equal(order?.openedBy, "relaxed_auto");
  });
});
