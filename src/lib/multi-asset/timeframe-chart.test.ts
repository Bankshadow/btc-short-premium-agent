import { describe, expect, it } from "vitest";
import {
  scoreTechnicalSnapshotForHorizon,
  TIMEFRAME_HORIZON_CONFIG,
} from "./timeframe-chart-logic";

describe("timeframe chart logic", () => {
  it("scores bullish daily snapshot as long bias", () => {
    const result = scoreTechnicalSnapshotForHorizon(
      {
        symbol: "BTCUSDT",
        timestamp: new Date().toISOString(),
        rsi14: 55,
        ema20: 100_500,
        ema50: 99_000,
        ema200: 95_000,
        trend: "bullish",
        macdHistogram: 120,
        support: 98_000,
        resistance: 102_000,
        atr4h: 800,
      },
      "LONG",
    );
    expect(result.direction).toBe("LONG");
    expect(Math.abs(result.score)).toBeGreaterThanOrEqual(
      TIMEFRAME_HORIZON_CONFIG.LONG.actionableScore,
    );
  });

  it("uses lower threshold for short horizon", () => {
    expect(TIMEFRAME_HORIZON_CONFIG.SHORT.actionableScore).toBeLessThan(
      TIMEFRAME_HORIZON_CONFIG.LONG.actionableScore,
    );
  });
});
