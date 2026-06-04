import type { StrategyId } from "./validation-types";

export const VALIDATION_THRESHOLDS = {
  minSignalsForPaperOnly: 20,
  minSignalsForActive: 12,
  minSignalsWatchlist: 5,
  avgRDisable: 0,
  avgRActive: 0.35,
  winRateActive: 52,
  maxDrawdownDisablePct: 12,
  maxDrawdownWatchPct: 8,
  profitFactorActive: 1.15,
  aggressiveMaxLossPct: -6,
  dailyLossLimitPct: -3,
  weeklyLossLimitPct: -7,
  portfolioMaxDrawdownPct: 15,
  lossStreakCooldown: 3,
  cooldownHours: 24,
  dataQualityLockoutScore: 35,
  minReservePct: 25,
  maxExperimentalPct: 10,
} as const;

export const STRATEGY_LABELS: Record<StrategyId, string> = {
  options_short_premium: "Options Short Premium",
  spot: "Spot",
  futures_long: "Futures Long",
  futures_short: "Futures Short",
  eth_btc: "ETH/BTC",
  aggressive_risk_mode: "Aggressive Risk Mode",
};

export const ALL_STRATEGY_IDS: StrategyId[] = [
  "options_short_premium",
  "spot",
  "futures_long",
  "futures_short",
  "eth_btc",
  "aggressive_risk_mode",
];
