import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreDataQuality } from "./data-quality-agent";
import { buildTradingDeskContext } from "./shared";
import type { AnalyzeApiResponse, DecisionEngineInput } from "@/lib/types/market";

function minimalContext(): ReturnType<typeof buildTradingDeskContext> {
  const input: DecisionEngineInput = {
    market: {
      symbol: "BTCUSDT",
      spotPrice: 90000,
      hv30: 0,
      iv: 0,
      ivHvRatio: 0,
      priceChange24hPct: 1,
      oiChange24hPct: null,
      oiChange1hPct: null,
      volumeChange24hPct: null,
    },
    optionCandidates: [],
    liquidation: { liquidation24h: null, source: "mock" },
    technicalDaily: { trend: "neutral", rsi: 50, atrPct: 1 },
    technical4h: { trend: "neutral", rsi: 50, atrPct: 1 },
    macroEvent: { hasEventBeforeSettlement: false },
    consecutiveLosses: 0,
  };
  const response = {
    step5_verdict: {
      recommendation: "wait",
      analyzedAt: new Date().toISOString(),
      missingData: [],
    },
    step4_combinationRead: { dataStatus: "ok", pattern: "neutral" },
  } as unknown as AnalyzeApiResponse;
  return buildTradingDeskContext(input, response);
}

describe("data quality scoring", () => {
  it("does not penalize missing options fields in Binance futures-only mode", () => {
    const prevProvider = process.env.MARKET_DATA_PROVIDER;
    const prevTestnet = process.env.BINANCE_TESTNET_ENABLED;
    process.env.MARKET_DATA_PROVIDER = "binance";
    process.env.BINANCE_TESTNET_ENABLED = "true";
    try {
      const score = scoreDataQuality(minimalContext());
      assert.ok(score >= 35, `expected score >= 35, got ${score}`);
    } finally {
      if (prevProvider === undefined) delete process.env.MARKET_DATA_PROVIDER;
      else process.env.MARKET_DATA_PROVIDER = prevProvider;
      if (prevTestnet === undefined) delete process.env.BINANCE_TESTNET_ENABLED;
      else process.env.BINANCE_TESTNET_ENABLED = prevTestnet;
    }
  });
});
