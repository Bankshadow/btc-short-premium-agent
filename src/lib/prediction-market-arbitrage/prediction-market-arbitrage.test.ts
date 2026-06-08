import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runPredictionArbCommittee } from "./agent-committee";
import { buildOutcomeBook, getMockPredictionMarkets } from "./market-data-connector";
import { detectMispricing } from "./mispricing-detector";
import { analyzeOrderBookDepth } from "./order-book-depth-analyzer";
import { simulateExecution } from "./execution-simulator";
import { scoreResolutionRisk } from "./resolution-risk-scorer";
import { runPredictionArbScan } from "./run-prediction-arb-scan";
import type { NormalizedPredictionMarket, OrderBookLevel } from "./types";
import { PREDICTION_ARB_DEFAULTS, bestAsk, bestBid } from "./config";

describe("binary mispricing detection", () => {
  it("detects buy-bundle when YES+NO asks sum below 1", () => {
    const markets = getMockPredictionMarkets();
    const binary = markets.find((m) => m.id === "mock-btc-100k-binary");
    assert.ok(binary);

    const candidates = detectMispricing(binary!);
    assert.ok(candidates.length > 0);
    const buy = candidates.find((c) => c.opportunityType === "BUY_BUNDLE");
    assert.ok(buy);
    assert.ok(buy!.theoreticalEdgePct > 0);

    const askSum = binary!.outcomes.reduce((acc, o) => acc + (o.bestAsk ?? 0), 0);
    assert.ok(askSum < 1);
  });
});

describe("multi-outcome mispricing detection", () => {
  it("flags multi-outcome ask sum deviation from parity", () => {
    const markets = getMockPredictionMarkets();
    const multi = markets.find((m) => m.id === "mock-fed-rates-multi");
    assert.ok(multi);

    const candidates = detectMispricing(multi!);
    assert.ok(candidates.length >= 1);

    const askSum = multi!.outcomes.reduce((acc, o) => acc + (o.bestAsk ?? 0), 0);
    assert.notEqual(askSum, 1);
  });
});

describe("order book depth analyzer", () => {
  it("rejects top-of-book-only mirage when VWAP erases edge", () => {
    const market: NormalizedPredictionMarket = {
      id: "test-thin",
      eventId: "e1",
      eventTitle: "Test event",
      marketTitle: "Thin book",
      marketType: "BINARY",
      mutuallyExclusive: true,
      resolutionRules: "Resolves YES if official API reports true. UMA oracle.",
      resolutionDeadline: "2027-01-01T00:00:00Z",
      feeRate: 0.002,
      slippageBps: 15,
      source: "mock",
      fetchedAt: new Date().toISOString(),
      outcomes: [
        buildOutcomeBook({
          outcomeId: "yes",
          outcomeLabel: "Yes",
          role: "YES",
          bids: [{ price: 0.48, size: 10 }],
          asks: [{ price: 0.49, size: 10 }],
        }),
        buildOutcomeBook({
          outcomeId: "no",
          outcomeLabel: "No",
          role: "NO",
          bids: [{ price: 0.48, size: 10 }],
          asks: [{ price: 0.49, size: 10 }],
        }),
      ],
    };

    const depth = analyzeOrderBookDepth({
      market,
      opportunityType: "BUY_BUNDLE",
      maxNotionalUsd: 500,
    });
    assert.ok(depth.executableSizeUsd <= 10);
  });
});

describe("resolution risk scorer", () => {
  it("blocks high ambiguity markets", () => {
    const markets = getMockPredictionMarkets();
    const risky = markets.find((m) => m.id === "mock-eth-merge-binary-tight");
    assert.ok(risky);
    const score = scoreResolutionRisk(risky!);
    assert.ok(score.flags.length > 0);
  });
});

describe("full scan pipeline", () => {
  it("returns paper-only scan result with committee votes", async () => {
    const result = await runPredictionArbScan({ mockOnly: true });
    assert.equal(result.simulationOnly, true);
    assert.equal(result.cannotExecuteOrders, true);
    assert.ok(result.marketsScanned >= 3);
    assert.ok(result.disclaimer.includes("Paper"));

    if (result.opportunities.length > 0) {
      const opp = result.opportunities[0];
      assert.ok(opp.agentVotes.length === 4);
      assert.ok(["TRADE", "WATCH", "NO_TRADE"].includes(opp.committeeVerdict));
    }
  });
});

describe("agent committee", () => {
  it("returns NO_TRADE when resolution blocked", () => {
    const markets = getMockPredictionMarkets();
    const market = markets[0];
    const candidates = detectMispricing(market);
    assert.ok(candidates[0]);

    const resolution = {
      score: 90,
      ambiguity: 80,
      oracleRisk: 70,
      deadlineRisk: 50,
      subjectiveWording: 40,
      blocked: true,
      flags: ["test"],
      summary: "blocked",
    };
    const depth = analyzeOrderBookDepth({
      market,
      opportunityType: candidates[0].opportunityType,
    });
    const simulation = simulateExecution({
      candidate: candidates[0],
      depth,
      resolution,
    });
    const committee = runPredictionArbCommittee({
      candidate: candidates[0],
      depth,
      simulation,
      resolution,
    });
    assert.equal(committee.verdict, "NO_TRADE");
  });
});

describe("config helpers", () => {
  it("computes best bid/ask", () => {
    const levels: OrderBookLevel[] = [
      { price: 0.4, size: 100 },
      { price: 0.42, size: 200 },
    ];
    assert.equal(bestBid(levels), 0.42);
    assert.equal(bestAsk(levels), 0.4);
  });
});
