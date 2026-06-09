import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  isTestnetTradeCycleAllowed,
  resolveTestnetExecutionVerdict,
} from "./resolve-testnet-execution-verdict";

function analysis(partial: Partial<AnalyzeApiResponse>): AnalyzeApiResponse {
  return partial as AnalyzeApiResponse;
}

describe("resolveTestnetExecutionVerdict", () => {
  const prior: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      "AUTOMATION_PRIMARY_MODE",
      "MARKET_DATA_PROVIDER",
      "BINANCE_TESTNET_FORCE_MAX_TRADES",
      "BINANCE_TESTNET_AUTOEXECUTE_ENABLED",
    ]) {
      prior[key] = process.env[key];
    }
    process.env.AUTOMATION_PRIMARY_MODE = "testnet_perp";
    process.env.MARKET_DATA_PROVIDER = "bybit";
    process.env.BINANCE_TESTNET_FORCE_MAX_TRADES = "false";
    process.env.BINANCE_TESTNET_AUTOEXECUTE_ENABLED = "false";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("promotes step5 TRADE when weighted committee is SKIP in testnet primary", () => {
    const data = analysis({
      step5_verdict: { recommendation: "TRADE", confidence: 70 },
      tradingDesk: {
        weightedCommittee: { weightedVerdict: "SKIP", tradeScore: 40 },
      },
    } as AnalyzeApiResponse);

    assert.equal(resolveTestnetExecutionVerdict(data), "TRADE");
  });

  it("uses weighted committee when step5 is also SKIP", () => {
    const data = analysis({
      step5_verdict: { recommendation: "SKIP", confidence: 40 },
      tradingDesk: {
        weightedCommittee: { weightedVerdict: "SKIP", tradeScore: 40 },
      },
    } as AnalyzeApiResponse);

    assert.equal(resolveTestnetExecutionVerdict(data), "SKIP");
  });

  it("uses committee final verdict in futures-only mode", () => {
    process.env.MARKET_DATA_PROVIDER = "binance";
    const data = analysis({
      step5_verdict: { recommendation: "WAIT", confidence: 50 },
      tradingDesk: {
        committee: { finalVerdict: "TRADE" },
        weightedCommittee: { weightedVerdict: "SKIP", tradeScore: 40 },
      },
    } as AnalyzeApiResponse);

    assert.equal(resolveTestnetExecutionVerdict(data), "TRADE");
  });
});

describe("isTestnetTradeCycleAllowed", () => {
  it("allows TRADE verdict", () => {
    assert.equal(isTestnetTradeCycleAllowed(null, "TRADE"), true);
  });
});
