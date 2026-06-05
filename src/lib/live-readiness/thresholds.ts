export const LIVE_READINESS_THRESHOLDS = {
  minStrictClosedTrades: 5,
  minStrictWinRatePct: 45,
  maxStrictDrawdownPct: 12,
  maxRecentLossStreak: 2,
  minExpectancyPct: 0,
  minDataTrustScore: 50,
  dataTrustFailScore: 35,
  minOperatorDisciplineScore: 55,
  operatorDisciplineWarningScore: 70,
  maxLiveNotionalCapUsd: 2000,
  defaultMaxLiveNotionalUsd: 500,
} as const;

export const LIVE_READINESS_SAFETY_NOTICE =
  "Live Readiness Dashboard is read-only. It cannot enable live execution, place trades, or change environment variables.";
