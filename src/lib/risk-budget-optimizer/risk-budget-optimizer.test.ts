import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { optimizeRiskBudget } from "./optimize-risk-budget";
import { applyRiskBudgetToAnalyzeResponse } from "./apply-risk-budget";
import { RISK_BUDGET_SAFETY_NOTICE } from "./types";
import type { RiskBudgetInput } from "./types";
import type { UnifiedPortfolioSnapshot } from "@/lib/portfolio/unified-types";
import type { AnalyzeApiResponse } from "@/lib/types/market";

function emptyPortfolio(): UnifiedPortfolioSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      baseEquityUsd: 10000,
      totalEquity: 10000,
      realizedPnlUsd: 0,
      unrealizedPnlUsd: 0,
      totalPnlUsd: 0,
      realizedPnlPct: 0,
      unrealizedPnlPct: 0,
      totalPnlPct: 0,
      openExposureUsd: 500,
      openExposurePct: 5,
      exposureByAsset: [],
      exposureByStrategy: [],
      winRate: 50,
      averageWinPct: 2,
      averageLossPct: -1.5,
      maxDrawdownPct: 4,
      maxDrawdownUsd: 400,
      dailyPnlUsd: -50,
      weeklyPnlUsd: -120,
      openCount: 1,
      closedCount: 5,
      winCount: 3,
      lossCount: 2,
    },
    openPositions: [],
    closedTrades: [],
    equityCurve: [
      { at: new Date().toISOString(), equityUsd: 10000, cumulativePnlUsd: 0 },
    ],
    pnlByAsset: [],
    pnlByStrategy: [],
    migrationApplied: false,
  };
}

function baseInput(overrides: Partial<RiskBudgetInput> = {}): RiskBudgetInput {
  return {
    portfolio: emptyPortfolio(),
    baseSizePct: 2.5,
    currentEquity: 10000,
    deskRiskProfile: "balanced",
    agentConfidence: 70,
    agentConflictLevel: "NONE",
    ...overrides,
  };
}

describe("risk-budget-optimizer", () => {
  it("caps size at governance max", () => {
    const result = optimizeRiskBudget(baseInput({ baseSizePct: 5 }));
    assert.equal(result.maxAllowedRiskPct, 2.5);
    assert.ok(result.recommendedRiskPct <= 2.5);
  });

  it("reduces size on loss streak", () => {
    const portfolio = emptyPortfolio();
    portfolio.closedTrades = [
      {
        id: "1",
        book: "btc_options",
        symbol: "BTC",
        assetId: null,
        side: "short",
        strategyName: "test",
        sourceAgent: "options",
        decisionLogId: "l1",
        verdict: "TRADE",
        riskProfile: "balanced",
        status: "CLOSED",
        createdAt: new Date().toISOString(),
        closedAt: new Date().toISOString(),
        notionalUsd: 100,
        sizePct: 1,
        entryPrice: 65000,
        exitPrice: 64000,
        realizedPnlUsd: -50,
        realizedPnlPct: -2,
        unrealizedPnlUsd: 0,
        unrealizedPnlPct: null,
        legacyRef: { book: "btc_options", id: "1" },
        notes: "",
      },
      {
        id: "2",
        book: "btc_options",
        symbol: "BTC",
        assetId: null,
        side: "short",
        strategyName: "test",
        sourceAgent: "options",
        decisionLogId: "l2",
        verdict: "TRADE",
        riskProfile: "balanced",
        status: "CLOSED",
        createdAt: new Date().toISOString(),
        closedAt: new Date().toISOString(),
        notionalUsd: 100,
        sizePct: 1,
        entryPrice: 65000,
        exitPrice: 64000,
        realizedPnlUsd: -30,
        realizedPnlPct: -1.5,
        unrealizedPnlUsd: 0,
        unrealizedPnlPct: null,
        legacyRef: { book: "btc_options", id: "2" },
        notes: "",
      },
    ];
    const result = optimizeRiskBudget(baseInput({ portfolio }));
    assert.ok(result.sizeReductionReasons.some((r) => /loss streak/i.test(r)));
    assert.ok(result.recommendedRiskPct < 2.5);
  });

  it("blocks on kill switch", () => {
    const result = optimizeRiskBudget(
      baseInput({
        killSwitch: {
          tradingPaused: true,
          aggressiveBlocked: true,
          activeReasons: ["operator_pause"],
          cooldownUntil: null,
          dailyPnlPct: -2,
          weeklyPnlPct: -3,
          peakToTroughDrawdownPct: 5,
          consecutiveLosses: 2,
          dataQualityScore: 50,
          messages: ["Operator pause"],
        },
      }),
    );
    assert.equal(result.liveTradingAllowed, false);
    assert.ok(result.blockReasons.length > 0);
  });

  it("applies budget to analyze response", () => {
    const budget = optimizeRiskBudget(baseInput());
    const response = {
      step6_actionPlan: { suggestedSizePct: 2.5, entryNotes: "test" },
      tradingDesk: {
        committee: {
          finalVerdict: "TRADE",
          topReasons: [],
          finalActionPlan: "Enter",
          riskVeto: false,
          consensusSummary: "",
          agreementNotes: [],
          disagreementNotes: [],
        },
      },
    } as unknown as AnalyzeApiResponse;

    const next = applyRiskBudgetToAnalyzeResponse(response, budget);
    assert.ok(next.step6_actionPlan.suggestedSizePct <= budget.recommendedRiskPct);
    assert.equal(next.riskBudget, budget);
  });

  it("exports safety notice", () => {
    const result = optimizeRiskBudget(baseInput());
    assert.equal(result.safetyNotice, RISK_BUDGET_SAFETY_NOTICE);
    assert.equal(result.cannotOverrideKillSwitch, true);
    assert.equal(result.cannotBypassApproval, true);
  });
});
