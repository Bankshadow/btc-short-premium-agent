import type { PolymarketConfig } from "./config-types";

const DEFAULT: PolymarketConfig = {
  minEdgeThreshold: 0.03,
  minConfidenceScore: 0.55,
  maxSpread: 0.08,
  minLiquidity: 500,
  maxExposurePerMarket: 100,
  maxExposureTotal: 500,
  maxTradesPerHour: 20,
  maxDailyLoss: 50,
  minTimeRemainingSeconds: 120,
  staleDataThresholdSeconds: 30,
  paperTradingEnabled: true,
  realTradingEnabled: false,
  killSwitchActive: false,
  mockMode: true,
};

export function loadPolymarketConfig(): PolymarketConfig {
  const env = process.env;
  return {
    minEdgeThreshold: num(env.POLYMARKET_MIN_EDGE, DEFAULT.minEdgeThreshold),
    minConfidenceScore: num(env.POLYMARKET_MIN_CONFIDENCE, DEFAULT.minConfidenceScore),
    maxSpread: num(env.POLYMARKET_MAX_SPREAD, DEFAULT.maxSpread),
    minLiquidity: num(env.POLYMARKET_MIN_LIQUIDITY, DEFAULT.minLiquidity),
    maxExposurePerMarket: num(env.POLYMARKET_MAX_EXPOSURE_PER_MARKET, DEFAULT.maxExposurePerMarket),
    maxExposureTotal: num(env.POLYMARKET_MAX_EXPOSURE_TOTAL, DEFAULT.maxExposureTotal),
    maxTradesPerHour: num(env.POLYMARKET_MAX_TRADES_PER_HOUR, DEFAULT.maxTradesPerHour),
    maxDailyLoss: num(env.POLYMARKET_MAX_DAILY_LOSS, DEFAULT.maxDailyLoss),
    minTimeRemainingSeconds: num(env.POLYMARKET_MIN_TIME_REMAINING_SEC, DEFAULT.minTimeRemainingSeconds),
    staleDataThresholdSeconds: num(env.POLYMARKET_STALE_DATA_SEC, DEFAULT.staleDataThresholdSeconds),
    paperTradingEnabled: bool(env.POLYMARKET_PAPER_ENABLED, DEFAULT.paperTradingEnabled),
    realTradingEnabled: false,
    killSwitchActive: bool(env.POLYMARKET_KILL_SWITCH, DEFAULT.killSwitchActive),
    mockMode: bool(env.POLYMARKET_MOCK_MODE, DEFAULT.mockMode),
  };
}

function num(raw: string | undefined, fallback: number): number {
  const n = Number(raw?.trim());
  return Number.isFinite(n) ? n : fallback;
}

function bool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === "") return fallback;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}
