export const LOOP_GUARD_STORE_FILE = "autopilot-loop-guard.json";
export const LOOP_GUARD_MAX_RECORDS = 120;
export const LOOP_GUARD_WINDOW_MINUTES = 30;

export const LOOP_GUARD_THRESHOLDS = {
  suspiciousSameAction: 3,
  stuckSameAction: 4,
  suspiciousApiFailures: 2,
  stuckApiFailures: 3,
  suspiciousCandidateRepeats: 3,
  stuckCandidateRepeats: 4,
  suspiciousStaleMarket: 4,
  stuckStaleMarket: 5,
  suspiciousFailureStreak: 3,
  stuckFailureStreak: 5,
  suspiciousSuccessRate: 0.2,
  stuckSuccessRate: 0.1,
  suspiciousDiversity: 0.3,
  stuckDiversity: 0.2,
  suspiciousSignalsToEscalate: 2,
  stuckSignalsToStop: 2,
  permissionGrantMinutes: 15,
} as const;
