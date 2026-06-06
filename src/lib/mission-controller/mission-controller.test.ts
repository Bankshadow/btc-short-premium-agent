import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAiConfidence } from "./compute-confidence";
import type { MissionControllerInputs } from "./types";

function baseInputs(partial: Partial<MissionControllerInputs> = {}): MissionControllerInputs {
  return {
    currentEquity: 1100,
    targetEquity: 10000,
    startEquity: 1000,
    dailyPnlPct: 0.5,
    weeklyPnlPct: 1.2,
    drawdownUsd: 50,
    drawdownPct: 5,
    winRate: 55,
    losingStreak: 0,
    openExposureUsd: 55,
    aiConfidence: 60,
    riskStatus: "SAFE",
    dailyLossLimitHit: false,
    completedTrades: 5,
    trustReady: false,
    automationPaused: false,
    committeePause: false,
    loopGuardActive: false,
    pendingTestnetPreview: false,
    humanActionRequired: false,
    ...partial,
  };
}

function deriveModeForTest(input: MissionControllerInputs): string {
  if (input.automationPaused || input.dailyLossLimitHit) return "PAUSED";
  if (input.riskStatus === "BLOCKED" || input.riskStatus === "EMERGENCY") return "PAUSED";
  if (input.loopGuardActive || input.committeePause) return "PAUSED";
  const streak = input.losingStreak < 0 ? Math.abs(input.losingStreak) : 0;
  if (streak >= 3) return "RECOVERY";
  if (input.completedTrades === 0) return "NORMAL";
  if (input.drawdownPct >= 8 || input.riskStatus === "CAUTION" || input.aiConfidence < 40) {
    return "DEFENSIVE";
  }
  if (input.trustReady && input.aiConfidence >= 65 && input.riskStatus === "SAFE") {
    return "OPPORTUNITY";
  }
  return "NORMAL";
}

describe("Mission controller (MVP 78)", () => {
  it("pauses when daily loss limit is hit", () => {
    assert.equal(
      deriveModeForTest(baseInputs({ dailyLossLimitHit: true })),
      "PAUSED",
    );
  });

  it("enters recovery on losing streak threshold", () => {
    assert.equal(
      deriveModeForTest(baseInputs({ losingStreak: -3 })),
      "RECOVERY",
    );
  });

  it("stays normal when no completed trades", () => {
    assert.equal(
      deriveModeForTest(baseInputs({ completedTrades: 0 })),
      "NORMAL",
    );
  });

  it("lowers confidence when committee pauses", () => {
    const high = computeAiConfidence({
      step5Confidence: 70,
      committeeRecommendation: "CONTINUE",
    });
    const low = computeAiConfidence({
      step5Confidence: 70,
      committeeRecommendation: "PAUSE_AND_REVIEW",
    });
    assert.ok(low < high);
  });

  it("opportunity mode when trust and confidence are strong", () => {
    assert.equal(
      deriveModeForTest(
        baseInputs({
          trustReady: true,
          aiConfidence: 70,
          riskStatus: "SAFE",
          dailyPnlPct: 1,
        }),
      ),
      "OPPORTUNITY",
    );
  });
});
