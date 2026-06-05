import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";

export const REALTIME_RISK_THRESHOLDS = {
  dailyLossLimitPct: VALIDATION_THRESHOLDS.dailyLossLimitPct,
  weeklyLossLimitPct: VALIDATION_THRESHOLDS.weeklyLossLimitPct,
  maxNotionalExposureUsd: Number(process.env.RISK_MAX_NOTIONAL_USD ?? 2500),
  maxAssetExposurePct: Number(process.env.RISK_MAX_ASSET_PCT ?? 40),
  maxStrategyExposurePct: Number(process.env.RISK_MAX_STRATEGY_PCT ?? 35),
  maxCorrelatedExposurePct: Number(process.env.RISK_MAX_CORRELATED_PCT ?? 50),
  maxMarginUsagePct: Number(process.env.RISK_MAX_MARGIN_PCT ?? 75),
  minLiqDistancePct: Number(process.env.RISK_MIN_LIQ_DISTANCE_PCT ?? 8),
  staleMarketDataMinutes: Number(process.env.RISK_STALE_MARKET_MIN ?? 30),
  dataTrustWarningScore: 50,
  dataTrustFailScore: 35,
  pilotDailyLossUsd: Number(process.env.PILOT_DAILY_LOSS_LIMIT_USD ?? 25),
  pilotWeeklyLossUsd: Number(process.env.PILOT_WEEKLY_LOSS_LIMIT_USD ?? 75),
} as const;
