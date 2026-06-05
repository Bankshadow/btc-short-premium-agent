import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkOrderAgainstRealTimeRisk } from "./check-order";
import { evaluateRealTimeRisk } from "./evaluate-realtime-risk";
import { applyRealTimeRiskToBudget } from "./bridge-risk-budget";
import { applyRealTimeRiskToOptionsChecks } from "./bridge-options";
import type { RealTimeRiskInput } from "./types";
import type { OrderPreviewResult } from "@/lib/exchange/types";
import { optimizeRiskBudget } from "@/lib/risk-budget-optimizer/optimize-risk-budget";
import { buildRiskBudgetInput } from "@/lib/risk-budget-optimizer/build-optimizer-input";

function basePreview(): OrderPreviewResult {
  return {
    valid: true,
    source: "perp_signal",
    category: "linear",
    symbol: "BTCUSDT",
    side: "Buy",
    rejectReasons: [],
    warnings: [],
    estNotionalUsd: 50,
    estQty: 0.001,
    estFeeUsd: 0.02,
    availableBalanceUsd: 1000,
    marginSufficient: true,
    bybitPayload: {},
    slTpPlan: { stopLoss: null, takeProfit: null },
    configured: true,
    network: "testnet",
    executeConfirmToken: null,
    executeConfirmExpiresAt: null,
    disclaimer: "test",
  };
}

function baseInput(overrides: Partial<RealTimeRiskInput> = {}): RealTimeRiskInput {
  return {
    entries: [],
    orders: [],
    governance: {
      pauseAnalysis: false,
      pausePaperAutoOpen: false,
      disableAggressiveMode: false,
      disableAlerts: false,
      safeMode: false,
      operatorPaused: false,
      operatorPauseReason: "",
      operatorPausedAt: null,
      cooldownUntil: null,
      operatorRole: "OPERATOR",
      operatorName: "Test",
    },
    ...overrides,
  };
}

describe("real-time risk MVP 42", () => {
  it("reports SAFE on clean input", () => {
    const report = evaluateRealTimeRisk(baseInput());
    assert.equal(report.riskStatus, "SAFE");
    assert.equal(report.blockNewTrades, false);
    assert.equal(report.cannotIncreaseRisk, true);
    assert.equal(report.cannotBypassGovernance, true);
    assert.ok(report.checks.length >= 10);
  });

  it("blocks new trades on governance pause", () => {
    const report = evaluateRealTimeRisk(
      baseInput({
        governance: {
          ...baseInput().governance!,
          operatorPaused: true,
          operatorPauseReason: "Manual pause",
        },
      }),
    );
    assert.equal(report.blockNewTrades, true);
    assert.ok(report.triggeredLimits.includes("governance_pause"));
  });

  it("reports EMERGENCY on critical incident", () => {
    const report = evaluateRealTimeRisk(
      baseInput({
        incidents: [
          {
            id: "i1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            type: "risk_breach",
            severity: "critical",
            description: "Test",
            affectedDecisionId: null,
            rootCause: "",
            correctiveAction: "",
            status: "open",
          },
        ],
      }),
    );
    assert.equal(report.riskStatus, "EMERGENCY");
    assert.equal(report.blockNewTrades, true);
  });

  it("check-order blocks when report is BLOCKED", () => {
    const report = evaluateRealTimeRisk(
      baseInput({
        emergencyStopActive: true,
      }),
    );
    const result = checkOrderAgainstRealTimeRisk({
      preview: basePreview(),
      report,
    });
    assert.equal(result.allowed, false);
    assert.ok(result.blockers.some((b) => b.includes("Real-time risk")));
  });

  it("check-order allows close when reduce-only", () => {
    const report = evaluateRealTimeRisk(
      baseInput({
        governance: {
          ...baseInput().governance!,
          safeMode: true,
        },
      }),
    );
    const result = checkOrderAgainstRealTimeRisk({
      preview: {
        ...basePreview(),
        bybitPayload: { reduceOnly: true },
      },
      report,
      isCloseOrder: true,
    });
    assert.equal(result.allowed, true);
  });

  it("applies real-time risk to risk budget", () => {
    const budgetInput = buildRiskBudgetInput({
      entries: [],
      orders: [],
      riskProfile: "balanced",
    });
    const budget = optimizeRiskBudget(budgetInput);
    const report = evaluateRealTimeRisk(
      baseInput({ emergencyStopActive: true }),
    );
    const adjusted = applyRealTimeRiskToBudget(budget, report);
    assert.equal(adjusted.liveTradingAllowed, false);
    assert.ok(adjusted.blockReasons.some((r) => r.includes("Real-time risk")));
  });

  it("bridges options checks from real-time report", () => {
    const report = evaluateRealTimeRisk(
      baseInput({ emergencyStopActive: true }),
    );
    const checks = applyRealTimeRiskToOptionsChecks(report);
    assert.ok(checks.some((c) => c.id === "realtime_risk_status" && c.blocking));
  });
});
