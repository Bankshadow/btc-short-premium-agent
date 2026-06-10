import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyEvidenceProgress } from "@/lib/evidence-progress";
import { emptyIntegratedConfidenceCalibration } from "@/lib/integrated-confidence-calibration/empty-snapshot";
import { emptyIntegratedStrategyHealth } from "@/lib/integrated-strategy-health/empty-snapshot";
import { emptyMicroLiveReadiness } from "@/lib/micro-live-readiness/empty-snapshot";
import { emptyIntegratedTradeQuality } from "@/lib/trade-quality-score/empty-snapshot";
import { buildRiskBudgetRecommendation } from "@/lib/integrated-risk-budget/build-risk-budget-recommendation";
import {
  INTEGRATED_RISK_BUDGET_LABEL,
  INTEGRATED_RISK_BUDGET_MVP,
  RISK_BUDGET_SAFETY_NOTICE,
} from "@/lib/integrated-risk-budget/types";
import { buildMissionControllerRiskBudget } from "./build-mission-controller-risk-budget";
import {
  computeLosingStreakFromClosedTrades,
  dailyLossLimitHit,
  resolveMissionMode,
} from "./resolve-mission-mode";
import type { TestnetClosedTrade } from "@/lib/testnet-monitor/types";

function closedTrade(result: "WIN" | "LOSS", closedAt: string): TestnetClosedTrade {
  return {
    id: `t-${closedAt}`,
    symbol: "BTCUSDT",
    side: "SELL",
    result,
    netPnl: result === "WIN" ? 10 : -10,
    closedAt,
  } as TestnetClosedTrade;
}

function buildTestRiskBudget(input?: {
  dailyPnlUsd?: number;
  equityUsd?: number;
}) {
  const { recommendation, analysis } = buildRiskBudgetRecommendation({
    configuredMaxNotional: 55,
    trustNotionalUsd: 55,
    evidenceProgress: {
      ...emptyEvidenceProgress(),
      evidenceSetReady: true,
      completedTrades: 12,
    },
    strategyHealth: emptyIntegratedStrategyHealth(),
    confidenceCalibration: emptyIntegratedConfidenceCalibration(),
    tradeQuality: emptyIntegratedTradeQuality(),
    microLiveReadiness: emptyMicroLiveReadiness(),
    openPositionCount: 0,
    dailyPnlUsd: input?.dailyPnlUsd,
    equityUsd: input?.equityUsd,
  });
  return {
    mvp: INTEGRATED_RISK_BUDGET_MVP,
    label: INTEGRATED_RISK_BUDGET_LABEL,
    recommendation,
    analysis,
    autoApplyAllowed: false as const,
    safetyNotice: RISK_BUDGET_SAFETY_NOTICE,
    lastUpdatedAt: new Date().toISOString(),
  };
}

describe("mission controller risk budget mvp92", () => {
  it("pauses mission when daily loss limit is hit", () => {
    const mode = resolveMissionMode({
      dailyLossLimitHit: true,
      automationPaused: false,
      criticalIncidentOpen: false,
      losingStreak: 0,
      dailyPnlStressed: true,
      strategyStatus: "CONTINUE",
      blocksNewTestnetEntries: false,
      riskBudgetMode: "COOLDOWN",
      drawdownPct: 0,
      overconfidence: false,
      avgQuality: 70,
      evidenceReady: true,
      readinessBlocked: false,
    });
    assert.equal(mode.mode, "PAUSED");

    const snapshot = buildMissionControllerRiskBudget({
      integratedRiskBudget: buildTestRiskBudget({
        dailyPnlUsd: -35,
        equityUsd: 1000,
      }),
      dailyPnlUsd: -35,
      currentEquity: 1000,
    });
    assert.equal(snapshot.missionMode, "PAUSED");
    assert.equal(snapshot.recommendedMaxOpenPositions, 0);
    assert.equal(snapshot.cannotIncreaseLiveRiskAutomatically, true);
  });

  it("computes losing streak from recent closed trades", () => {
    const streak = computeLosingStreakFromClosedTrades([
      closedTrade("LOSS", "2026-06-03T00:00:00.000Z"),
      closedTrade("LOSS", "2026-06-02T00:00:00.000Z"),
      closedTrade("WIN", "2026-06-01T00:00:00.000Z"),
    ]);
    assert.equal(streak, 2);
  });

  it("requires human approval and never auto-increases risk", () => {
    const snapshot = buildMissionControllerRiskBudget({
      integratedRiskBudget: buildTestRiskBudget(),
    });
    assert.equal(snapshot.humanApprovalRequired, true);
    assert.equal(snapshot.autoApplyAllowed, false);
    assert.ok(
      snapshot.recommendedMaxNotional <= snapshot.currentMaxNotional,
    );
    assert.ok(dailyLossLimitHit(-3.1));
    assert.ok(!dailyLossLimitHit(-2.9));
  });
});
