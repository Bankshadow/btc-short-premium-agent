import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runRiskReplaySimulation } from "./engine";

describe("Risk Replay", () => {
  it("simulates what-if scenarios without mutating actual", () => {
    const report = runRiskReplaySimulation({
      tradeId: "paper-1",
      environment: "PAPER",
      symbol: "BTCUSDT",
      strategy: "short_premium",
      side: "LONG",
      quantity: 1,
      notionalUsd: 1000,
      openedAt: "2026-01-01T00:00:00.000Z",
      closedAt: "2026-01-01T01:00:00.000Z",
      entryPrice: 100,
      exitPrice: 95,
      actualPnlUsd: -5,
      originalDecision: {
        decisionLogId: "dec-1",
        finalVerdict: "TRADE",
        confidence: 0.6,
        topReasons: ["momentum"],
      },
      originalRiskSettings: {
        profile: "balanced",
        sizePct: 1,
        maxRiskPct: 2,
      },
      originalStopTakeProfit: {
        stopLoss: 98,
        takeProfit: 104,
      },
      marketPricePath: [
        { timestamp: "2026-01-01T00:00:00.000Z", price: 100 },
        { timestamp: "2026-01-01T00:20:00.000Z", price: 103 },
        { timestamp: "2026-01-01T00:40:00.000Z", price: 97 },
        { timestamp: "2026-01-01T01:00:00.000Z", price: 95 },
      ],
    });

    assert.equal(report.actualResult.simulated, false);
    assert.equal(report.simulatedResults.length, 9);
    assert.ok(
      report.simulatedResults.some((s) => s.scenarioId === "NO_TRADE"),
      "must include no-trade scenario",
    );
    assert.ok(
      report.simulatedResults.some((s) => s.scenarioId === "WAIT_FOR_CONFIRMATION"),
      "must include wait-for-confirmation scenario",
    );
    assert.ok(report.confidence >= 35 && report.confidence <= 95);
    assert.ok(
      report.riskNote.toLowerCase().includes("simulation only"),
      "must enforce simulation safety message",
    );
  });
});
