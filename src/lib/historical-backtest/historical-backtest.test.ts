import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { buildHistoricalMarketBar } from "./reconstruct-bar";
import { generateOptionsCandidates } from "./build-engine-input";
import { computeBacktestMetrics } from "./compute-metrics";
import { runHistoricalBacktest } from "./run-backtest";
import { compareBacktestScenarios } from "./compare-backtest";
import { HISTORICAL_BACKTEST_SAFETY_NOTICE } from "./types";
import type { BacktestTrade } from "./types";

function mockEntry(overrides: Partial<DecisionLogEntry> = {}): DecisionLogEntry {
  return {
    id: `log-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    btcPrice: 65000,
    marketRegime: "Range-bound · premium selling",
    agentOutputs: [],
    finalVerdict: "WAIT",
    riskVeto: false,
    topReasons: ["IV/HV compressed"],
    actionPlan: "Wait for setup",
    outcomeStatus: "RESOLVED",
    paperPnl: 1.2,
    reflection: null,
    ...overrides,
  };
}

describe("historical-backtest", () => {
  it("reconstructs market bar from log entry", () => {
    const bar = buildHistoricalMarketBar(
      mockEntry({ btcPrice: 64000, marketRegime: "Risk-on bull trend" }),
      63000,
    );
    assert.equal(bar.trend, "bullish");
    assert.ok(bar.ivHvRatio > 0);
    assert.equal(bar.spotPrice, 64000);
  });

  it("generates options candidates from bar", () => {
    const bar = buildHistoricalMarketBar(mockEntry(), null);
    const candidates = generateOptionsCandidates(bar);
    assert.ok(candidates.length >= 3);
    assert.ok(candidates[0].strike > bar.spotPrice);
  });

  it("runs historical backtest through desk pipeline", () => {
    const entries = [
      mockEntry({ finalVerdict: "TRADE", paperPnl: 2 }),
      mockEntry({
        finalVerdict: "SKIP",
        marketRegime: "Liquidation risk",
        paperPnl: -1,
      }),
      mockEntry({ finalVerdict: "WAIT", paperPnl: 0 }),
    ];
    const result = runHistoricalBacktest({
      scenario: {
        id: "test",
        label: "Test",
        versionTag: "current",
        maxSessions: 3,
        riskProfile: "balanced",
      },
      entries,
    });
    assert.equal(result.run.simulationOnly, true);
    assert.equal(result.run.cannotEnableLive, true);
    assert.equal(result.run.cannotAutoApprove, true);
    assert.equal(result.metrics.sessionsReplayed, 3);
    assert.ok(result.trades.length === 3);
    assert.ok(result.regimeBreakdown.length > 0);
    assert.equal(result.safetyNotice, HISTORICAL_BACKTEST_SAFETY_NOTICE);
  });

  it("compares baseline vs proposed scenarios", () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      mockEntry({
        id: `e-${i}`,
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        finalVerdict: i % 2 === 0 ? "TRADE" : "SKIP",
        paperPnl: i % 2 === 0 ? 1.5 : 0,
      }),
    );
    const compare = compareBacktestScenarios({
      entries,
      baseline: {
        id: "base",
        label: "Current",
        versionTag: "current",
        riskProfile: "balanced",
      },
      proposed: {
        id: "prop",
        label: "Proposed",
        versionTag: "proposed",
        riskProfile: "balanced",
        proposedRuleTightening: true,
      },
    });
    assert.ok(compare.comparison.baselineVersion === "current");
    assert.ok(compare.comparison.proposedVersion === "proposed");
    assert.ok(compare.baseline.trades.length > 0);
    assert.ok(compare.proposed.trades.length > 0);
  });

  it("computes metrics including false trade counts", () => {
    const trades: BacktestTrade[] = [
      {
        logId: "1",
        timestamp: new Date().toISOString(),
        btcPrice: 65000,
        marketRegime: "Range",
        loggedVerdict: "TRADE",
        simulatedVerdict: "TRADE",
        simulatedRiskVeto: false,
        playbookVerdict: "trade",
        aligned: true,
        pnlPct: -2,
        primaryRegime: "SIDEWAYS",
        strategiesRecommended: [],
        strategiesBlocked: [],
        ruleTriggers: [],
        falseTrade: true,
        falseSkip: false,
        missedOpportunity: false,
        riskVetoBlocked: false,
      },
      {
        logId: "2",
        timestamp: new Date().toISOString(),
        btcPrice: 65000,
        marketRegime: "Range",
        loggedVerdict: "SKIP",
        simulatedVerdict: "TRADE",
        simulatedRiskVeto: false,
        playbookVerdict: "trade",
        aligned: false,
        pnlPct: 3,
        primaryRegime: "SIDEWAYS",
        strategiesRecommended: [],
        strategiesBlocked: [],
        ruleTriggers: [],
        falseTrade: false,
        falseSkip: false,
        missedOpportunity: false,
        riskVetoBlocked: false,
      },
    ];
    const metrics = computeBacktestMetrics(trades, 2);
    assert.equal(metrics.falseTradeCount, 1);
    assert.equal(metrics.tradeFrequency, 2);
    assert.equal(metrics.totalReturnPct, 1);
    assert.equal(metrics.winRate, 50);
  });
});
