import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DecisionEngineInput } from "@/lib/types/market";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import { detectMarketRegime } from "./detect-regime";
import { routeStrategiesForRegime } from "./route-strategies";
import { applyRegimeBrainGateToAgent } from "./apply-regime-gates";
import type { AgentOutput } from "@/lib/agents/types";
import { REGIME_BRAIN_SAFETY_NOTICE } from "./types";

function mockInput(
  marketOverrides: Partial<DecisionEngineInput["market"]> = {},
  engineOverrides: Partial<DecisionEngineInput> = {},
): RegimeBrainInput {
  const input = {
    market: {
      spotPrice: 65000,
      priceChange24hPct: 2.5,
      hv30: 22,
      iv: 28,
      ivHvRatio: 1.27,
      ivRank: 55,
      ivPercentile: 60,
      fundingRate: 0.0001,
      openInterestBtc: 100000,
      oiChange24hPct: 3,
      oiChange1hPct: 0.5,
      volume24hBtc: 50000,
      volumeChange24hPct: 5,
      ...marketOverrides,
    },
    technicalDaily: { trend: "bullish" as const, rsi: 55, support: 64000, resistance: 66000 },
    technical4h: { trend: "bullish" as const, rsi: 52, support: 64500, resistance: 65500 },
    technical1h: { trend: "neutral" as const, rsi: 50, support: 64800, resistance: 65200 },
    macroEvent: { hasEventBeforeSettlement: false, eventLabel: null, hoursToSettlement: 24 },
    liquidation: { liquidation24h: 50_000_000 },
    optionCandidates: [],
    macroView: "bearish" as const,
    deskRiskProfile: "balanced" as const,
    consecutiveLosses: 0,
    ...engineOverrides,
  } as unknown as DecisionEngineInput;

  const response = {
    step4_combinationRead: { pattern: "neutral", liquidationRegime: "normal" },
    step5_verdict: { analyzedAt: new Date().toISOString(), missingData: [] },
  } as unknown as AnalyzeApiResponse;

  return { input, response };
}

type RegimeBrainInput = import("./types").RegimeBrainInput;

function agent(name: string): AgentOutput {
  return {
    agentName: name,
    recommendation: "TRADE",
    strategyType: "OPTIONS",
    confidence: "HIGH",
    marketView: "test",
    reasons: [],
    risks: [],
    proposedAction: "test",
    missingData: [],
  };
}

describe("market-regime-brain", () => {
  it("detects bull trend with evidence", () => {
    const result = detectMarketRegime(mockInput());
    assert.equal(result.advisoryOnly, true);
    assert.equal(result.cannotOverrideRiskVeto, true);
    assert.ok(result.regimeConfidence >= 45);
    assert.ok(result.evidence.length > 0);
    assert.ok(result.safetyNotice.includes("advisory"));
  });

  it("detects liquidation risk on high liquidation", () => {
    const result = detectMarketRegime(
      mockInput({}, { liquidation: { liquidation24h: 500_000_000 } }),
    );
    assert.ok(
      result.primaryRegime === "LIQUIDATION_RISK" ||
        result.secondaryRegimes.includes("LIQUIDATION_RISK"),
    );
    assert.ok(result.blockedStrategies.length > 0);
    assert.equal(result.tradeFrequencyRecommendation, "PAUSE");
  });

  it("routes range-bound premium selling strategies", () => {
    const routing = routeStrategiesForRegime("RANGE_BOUND_PREMIUM_SELLING");
    assert.ok(routing.recommended.includes("options_short_premium"));
    assert.ok(routing.blocked.includes("futures_long"));
  });

  it("gates options agent when regime blocks strategy", () => {
    const brain = detectMarketRegime({
      ...mockInput(),
      input: {
        ...mockInput().input,
        macroEvent: { hasEventBeforeSettlement: true, eventLabel: "FOMC", hoursToSettlement: 2 },
      } as DecisionEngineInput,
    });
    const gated = applyRegimeBrainGateToAgent(
      agent("Options Strategy Agent"),
      {
        ...brain,
        blockedStrategies: ["options_short_premium", "spot", "futures_long", "futures_short", "eth_btc"],
        tradeFrequencyRecommendation: "PAUSE",
      },
    );
    assert.equal(gated.recommendation, "SKIP");
    assert.ok(gated.reasons[0].includes("Regime Brain"));
  });

  it("exports safety notice", () => {
    assert.ok(REGIME_BRAIN_SAFETY_NOTICE.includes("cannot override risk veto"));
  });
});
