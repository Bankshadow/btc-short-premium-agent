import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateLivePosition, aggregateRecommendation } from "./evaluate-position";
import { runLiveTradeSupervisor } from "./run-supervisor";
import { buildSupervisorClosePreview } from "./build-close-preview";
import { buildEmergencyTriggerResponse } from "./trigger-emergency";
import { LIVE_SUPERVISOR_SAFETY_NOTICE } from "./types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";

function mockTrade(): LiveTradeJournalEntry {
  return {
    liveTradeId: "live-1",
    sourceSignalId: "btc-LONG",
    decisionLogId: "log-1",
    previewId: "p1",
    confirmTokenId: "tok",
    exchangeOrderId: "ex-1",
    status: "OPEN",
    symbol: "BTCUSDT",
    side: "Buy",
    entry: {
      price: 65000,
      qty: 0.01,
      notionalUsd: 650,
      side: "Buy",
      symbol: "BTCUSDT",
      timestamp: new Date().toISOString(),
    },
    exit: null,
    realizedPnl: null,
    fees: null,
    slippage: null,
    operatorApproval: true,
    operatorApprovalNote: "test",
    createdAt: new Date().toISOString(),
    executedAt: new Date().toISOString(),
    closedAt: null,
    error: null,
    pilotMode: "LIVE_SMALL_PILOT",
  };
}

function mockEntry(): DecisionLogEntry {
  return {
    id: "log-1",
    timestamp: new Date().toISOString(),
    btcPrice: 65000,
    marketRegime: "Risk-on bull",
    agentOutputs: [],
    finalVerdict: "TRADE",
    riskVeto: false,
    topReasons: ["Bull thesis"],
    actionPlan: "Long perp",
    outcomeStatus: "PENDING",
    paperPnl: null,
    reflection: null,
    orderTicket: {
      id: "t1",
      decisionLogId: "log-1",
      generatedAt: new Date().toISOString(),
      strategy: "Futures Long",
      strategyId: "futures_long",
      symbol: "BTCUSDT",
      side: "long",
      instrument: "no_trade",
      entryPrice: 65000,
      entryOptionMark: null,
      strike: null,
      stopLoss: 63000,
      takeProfit: 67000,
      positionSizePct: 1.5,
      maxRiskPct: 1.5,
      invalidation: "test",
      forcedExit: "test",
      confidence: 70,
      confidenceLevel: "MEDIUM",
      topReasons: [],
    },
  };
}

describe("live-trade-supervisor", () => {
  it("evaluates position with thesis and health", () => {
    const result = evaluateLivePosition({
      trade: mockTrade(),
      context: {
        openTrades: [],
        entries: [mockEntry()],
        market: {
          symbol: "BTCUSDT",
          spotPrice: 64000,
          timestamp: new Date().toISOString(),
          hv30: 25,
          iv: 30,
          ivHvRatio: 1.1,
          ivRank: 50,
          ivPercentile: 50,
          fundingRate: 0.0002,
          openInterestBtc: 100000,
          oiChange24hPct: 2,
          oiChange1hPct: 0.5,
          volume24hBtc: 50000,
          volumeChange24hPct: 3,
          priceChange24hPct: -1.5,
        },
        regimeBrain: {
          generatedAt: new Date().toISOString(),
          primaryRegime: "BEAR_TREND",
          secondaryRegimes: [],
          canonicalRegime: "risk_off",
          deskLabel: "Risk-off bear",
          regimeConfidence: 70,
          regimeRisks: [],
          evidence: [],
          recommendedStrategies: [],
          blockedStrategies: ["futures_long"],
          sizingMultiplier: 0.5,
          tradeFrequencyRecommendation: "REDUCE",
          safetyNotice: "",
          advisoryOnly: true,
          cannotOverrideRiskVeto: true,
          cannotEnableLive: true,
        },
        entryFundingRate: 0.0001,
      },
    });
    assert.ok(result.health.entryPrice === 65000);
    assert.ok(result.alerts.length > 0);
    assert.equal(result.canOpenNewPosition, false);
    assert.equal(result.canIncreaseExposure, false);
  });

  it("runs supervisor for open trades", () => {
    const report = runLiveTradeSupervisor({
      openTrades: [mockTrade()],
      entries: [mockEntry()],
      market: {
        symbol: "BTCUSDT",
        spotPrice: 65500,
        timestamp: new Date().toISOString(),
        hv30: 22,
        iv: 28,
        ivHvRatio: 1,
        ivRank: 45,
        ivPercentile: 45,
        fundingRate: 0.0001,
        openInterestBtc: 100000,
        oiChange24hPct: 1,
        oiChange1hPct: 0,
        volume24hBtc: 40000,
        volumeChange24hPct: 2,
        priceChange24hPct: 0.5,
      },
    });
    assert.equal(report.openPositionCount, 1);
    assert.equal(report.autoCloseEnabled, false);
    assert.equal(report.safetyNotice, LIVE_SUPERVISOR_SAFETY_NOTICE);
  });

  it("builds reduce-only close preview", () => {
    const preview = buildSupervisorClosePreview({
      trade: mockTrade(),
      request: { liveTradeId: "live-1", mode: "partial_close", partialPct: 50 },
      markPrice: 64800,
    });
    assert.ok(preview);
    assert.equal(preview!.reduceOnly, true);
    assert.equal(preview!.requiresHumanApproval, true);
    assert.ok(preview!.qty < mockTrade().entry!.qty);
  });

  it("aggregates worst-case recommendation", () => {
    const agg = aggregateRecommendation([
      { recommendation: "HOLD" } as never,
      { recommendation: "CLOSE" } as never,
    ]);
    assert.equal(agg, "CLOSE");
  });

  it("emergency trigger disables auto-close", () => {
    const result = buildEmergencyTriggerResponse({ operatorNote: "test stop" });
    assert.equal(result.autoCloseTriggered, false);
    assert.equal(result.pilotEmergencyStop, true);
    assert.equal(result.governanceKillSwitch, true);
  });
});
