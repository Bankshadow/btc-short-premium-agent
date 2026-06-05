import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildScaleUpReport } from "./build-scale-report";
import { evaluatePromotionEligibility } from "./evaluate-promotion";
import { evaluateDemotionTriggers, resolveAutoDemotion } from "./evaluate-demotion";
import { promoteStage, demoteStage } from "./stage-actions";
import { checkScaleUpGuards } from "./scale-guards";
import { resolveEffectiveScaleLimits } from "./resolve-effective-limits";
import { defaultScaleStage, getStageDefinition } from "./stage-definitions";
import type { ScaleUpInput } from "./types";
import type { OrderPreviewResult } from "@/lib/exchange/types";
import type { LiveReadinessReport } from "@/lib/live-readiness/types";
import type { RealTimeRiskReport } from "@/lib/real-time-risk/types";

function basePreview(): OrderPreviewResult {
  return {
    valid: true,
    source: "perp_signal",
    category: "linear",
    symbol: "BTCUSDT",
    side: "Buy",
    rejectReasons: [],
    warnings: [],
    estNotionalUsd: 20,
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

function baseReadiness(status: LiveReadinessReport["overallStatus"] = "PASS"): LiveReadinessReport {
  return {
    generatedAt: new Date().toISOString(),
    overallStatus: status,
    overallScore: status === "PASS" ? 85 : 40,
    hardBlockers: status === "PASS" ? [] : ["test blocker"],
    readyForSmallLivePerpPilot: status === "PASS",
    categories: [],
    safetyNotice: "test",
    cannotEnableLive: true,
    cannotPlaceTrades: true,
    cannotChangeEnv: true,
  };
}

function baseRisk(
  status: RealTimeRiskReport["riskStatus"] = "SAFE",
): RealTimeRiskReport {
  return {
    generatedAt: new Date().toISOString(),
    riskStatus: status,
    blockNewTrades: status === "BLOCKED" || status === "EMERGENCY",
    blockIncreaseExposure: false,
    reduceOnlyMode: false,
    recommendedActions: [],
    riskEvents: [],
    triggeredLimits: [],
    checks: [],
    metrics: {
      dailyPnlPct: 0,
      weeklyPnlPct: 0,
      totalNotionalUsd: 0,
      marginUsagePct: null,
      minLiqDistancePct: null,
    },
    safetyNotice: "test",
    cannotIncreaseRisk: true,
    cannotBypassGovernance: true,
  };
}

function baseInput(overrides: Partial<ScaleUpInput> = {}): ScaleUpInput {
  return {
    currentStage: "LIVE_STAGE_1_SMOKE_TEST",
    journal: [],
    incidents: [],
    readiness: baseReadiness(),
    realTimeRisk: baseRisk(),
    ...overrides,
  };
}

describe("live scale-up MVP 43", () => {
  it("defaults to disabled stage", () => {
    assert.equal(defaultScaleStage(), "LIVE_STAGE_0_DISABLED");
    const limits = resolveEffectiveScaleLimits(defaultScaleStage());
    assert.equal(limits.tradingEnabled, false);
    assert.equal(limits.maxNotionalPerTrade, 0);
  });

  it("blocks trading at disabled stage", () => {
    const guard = checkScaleUpGuards({
      stage: "LIVE_STAGE_0_DISABLED",
      preview: basePreview(),
      journal: [],
    });
    assert.equal(guard.allowed, false);
    assert.ok(guard.blockers.some((b) => b.includes("disabled")));
  });

  it("allows smoke test within notional cap", () => {
    const guard = checkScaleUpGuards({
      stage: "LIVE_STAGE_1_SMOKE_TEST",
      preview: basePreview(),
      journal: [],
    });
    assert.equal(guard.allowed, true);
  });

  it("blocks promotion without readiness PASS", () => {
    const promo = evaluatePromotionEligibility(
      baseInput({
        currentStage: "LIVE_STAGE_1_SMOKE_TEST",
        readiness: baseReadiness("FAIL"),
      }),
    );
    assert.equal(promo.eligible, false);
    assert.ok(promo.blockers.some((b) => b.includes("readiness")));
  });

  it("blocks promotion when real-time risk blocked", () => {
    const promo = evaluatePromotionEligibility(
      baseInput({
        currentStage: "LIVE_STAGE_1_SMOKE_TEST",
        realTimeRisk: baseRisk("BLOCKED"),
      }),
    );
    assert.equal(promo.eligible, false);
  });

  it("requires operator approval for promotion", () => {
    const result = promoteStage(baseInput({ currentStage: "LIVE_STAGE_1_SMOKE_TEST" }), {
      targetStage: "LIVE_STAGE_2_MICRO_SIZE",
      operatorApproval: false,
    });
    assert.equal(result.ok, false);
    assert.ok(result.error?.includes("operatorApproval"));
  });

  it("promotes one stage when eligible", () => {
    const closedJournal = Array.from({ length: 3 }).map((_, i) => ({
      liveTradeId: `t${i}`,
      sourceSignalId: null,
      decisionLogId: null,
      previewId: "p1",
      confirmTokenId: "tok",
      exchangeOrderId: "ex",
      status: "CLOSED" as const,
      symbol: "BTCUSDT",
      side: "Buy",
      entry: { price: 60000, qty: 0.001, notionalUsd: 60, side: "Buy", symbol: "BTCUSDT", timestamp: new Date().toISOString() },
      exit: null,
      realizedPnl: 2,
      fees: 0.1,
      slippage: 0.1,
      operatorApproval: true,
      operatorApprovalNote: null,
      createdAt: new Date().toISOString(),
      executedAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      error: null,
      pilotMode: "LIVE_SMALL_PILOT" as const,
    }));

    const result = promoteStage(
      baseInput({
        currentStage: "LIVE_STAGE_1_SMOKE_TEST",
        journal: closedJournal,
      }),
      {
        targetStage: "LIVE_STAGE_2_MICRO_SIZE",
        operatorApproval: true,
        operatorNote: "Approved after smoke test",
      },
    );
    assert.equal(result.ok, true);
    assert.equal(result.toStage, "LIVE_STAGE_2_MICRO_SIZE");
  });

  it("auto-demotes on emergency stop", () => {
    const auto = resolveAutoDemotion(
      baseInput({
        currentStage: "LIVE_STAGE_2_MICRO_SIZE",
        emergencyStopActive: true,
      }),
    );
    assert.equal(auto.shouldAutoDemote, true);
    assert.equal(auto.targetStage, "LIVE_STAGE_0_DISABLED");
  });

  it("demotes one stage on non-critical triggers", () => {
    const triggers = evaluateDemotionTriggers(
      baseInput({
        currentStage: "LIVE_STAGE_2_MICRO_SIZE",
        realTimeRisk: {
          ...baseRisk("BLOCKED"),
          checks: [
            {
              id: "live_position_mismatch",
              label: "Mismatch",
              status: "WARNING",
              message: "Journal vs exchange mismatch",
              blocking: false,
            },
          ],
        },
      }),
    );
    assert.ok(triggers.some((t) => t.id === "exchange_mismatch" && t.active));
  });

  it("manual demote reduces stage", () => {
    const result = demoteStage("LIVE_STAGE_3_SMALL_SIZE", {
      operatorNote: "Operator pullback",
    });
    assert.equal(result.ok, true);
    assert.equal(result.toStage, "LIVE_STAGE_2_MICRO_SIZE");
  });

  it("builds report with all panels", () => {
    const report = buildScaleUpReport(baseInput());
    assert.ok(report.currentStageDefinition);
    assert.ok(report.promotion);
    assert.ok(report.demotionTriggers.length > 0);
    assert.equal(report.cannotAutoPromote, true);
    assert.equal(report.btcOptionsExcluded, true);
    assert.equal(getStageDefinition(report.currentStage).tradingEnabled, true);
  });
});
