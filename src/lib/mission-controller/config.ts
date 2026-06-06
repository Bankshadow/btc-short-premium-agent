import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import { riskConsecutiveLossVeto } from "@/lib/desk/desk-risk-policy";

export const MISSION_LOSING_STREAK_RECOVERY = VALIDATION_THRESHOLDS.lossStreakCooldown;

export const MISSION_DRAWDOWN_DEFENSIVE_PCT = 8;

export const MISSION_CONFIDENCE_OPPORTUNITY = 65;

export const MISSION_CONFIDENCE_DEFENSIVE = 40;

export const CORE_STRATEGY_TYPES = [
  "futures_short",
  "btc_short_premium",
  "perp_momentum",
] as const;

export const FULL_STRATEGY_TYPES = [
  ...CORE_STRATEGY_TYPES,
  "futures_long",
  "eth_btc",
  "spot",
] as const;

export const RECOVERY_STRATEGY_TYPES = ["futures_short", "btc_short_premium"] as const;

export function losingStreakThreshold(): number {
  return Math.max(MISSION_LOSING_STREAK_RECOVERY, riskConsecutiveLossVeto());
}
