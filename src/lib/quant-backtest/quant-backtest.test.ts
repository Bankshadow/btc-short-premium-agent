import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAiPaperRecommendation } from "./build-ai-recommendation";
import { computeQuantMetrics } from "./compute-metrics";
import { generateSignalSeries, isQuantBacktestRunnerSupported } from "./signal-runners";
import type { Candle } from "@/lib/indicators/technical";

function mockCandles(count: number, trend: "up" | "down" | "flat"): Candle[] {
  const candles: Candle[] = [];
  let price = 100;
  for (let i = 0; i < count; i += 1) {
    const delta = trend === "up" ? 0.5 : trend === "down" ? -0.5 : 0;
    price += delta;
    candles.push({
      timestamp: Date.UTC(2024, 0, 1) + i * 3_600_000,
      open: price,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 10_000,
    });
  }
  return candles;
}

describe("Quant Backtest (MVP 67)", () => {
  it("supports initial indicator runners", () => {
    assert.equal(isQuantBacktestRunnerSupported("macd-oscillator"), true);
    assert.equal(isQuantBacktestRunnerSupported("rsi-pattern-recognition"), true);
    assert.equal(isQuantBacktestRunnerSupported("bollinger-bands-pattern"), true);
    assert.equal(isQuantBacktestRunnerSupported("dual-thrust"), true);
    assert.equal(isQuantBacktestRunnerSupported("heikin-ashi"), true);
    assert.equal(isQuantBacktestRunnerSupported("pair-trading"), false);
  });

  it("generates signal series for MACD", () => {
    const candles = mockCandles(120, "up");
    const signals = generateSignalSeries("macd-oscillator", candles);
    assert.equal(signals.length, candles.length);
  });

  it("computes metrics with profit factor", () => {
    const metrics = computeQuantMetrics([
      {
        id: "1",
        direction: "LONG",
        entryTime: "2024-01-01",
        exitTime: "2024-01-02",
        entryPrice: 100,
        exitPrice: 102,
        grossPnlPct: 2,
        netPnlPct: 1.5,
        frictionCostPct: 0.5,
        regime: "bullish",
        barsHeld: 4,
      },
      {
        id: "2",
        direction: "SHORT",
        entryTime: "2024-01-03",
        exitTime: "2024-01-04",
        entryPrice: 100,
        exitPrice: 101,
        grossPnlPct: -1,
        netPnlPct: -1.4,
        frictionCostPct: 0.4,
        regime: "neutral",
        barsHeld: 3,
      },
    ]);
    assert.equal(metrics.tradeCount, 2);
    assert.ok(metrics.profitFactor > 0);
  });

  it("recommends insufficient data for tiny samples", () => {
    const rec = buildAiPaperRecommendation({
      metrics: computeQuantMetrics([]),
      liquidity: { level: "OK", message: "ok", avgBarVolume: 1000 },
      strategyName: "MACD",
      symbol: "BTCUSDT",
      barsLoaded: 20,
    });
    assert.equal(rec.verdict, "INSUFFICIENT_DATA");
    assert.equal(rec.paperTestnetAllowed, false);
  });
});
