import type { TradeRecommendation } from "@/lib/types/market";

/** Desk-wide risk posture — aggressive favors TRADE when playbook is constructive. */
export const DESK_RISK_PROFILE = "aggressive" as const;

export function isAggressiveDeskRisk(): boolean {
  return DESK_RISK_PROFILE === "aggressive";
}

/** Minimum data-quality score before committee downgrades to WAIT. */
export function committeeMinDataQualityScore(): number {
  return isAggressiveDeskRisk() ? 25 : 45;
}

/** IV/HV floor for short-premium risk veto (playbook default 1.15). */
export function riskIvHvFloor(): number {
  return isAggressiveDeskRisk() ? 1.05 : 1.15;
}

/** SD distance floor for options risk veto (playbook default 1.5). */
export function riskSdFloor(): number {
  return isAggressiveDeskRisk() ? 1.2 : 1.5;
}

/** Missing critical fields before risk hard-veto (aggressive allows partial tape). */
export function riskMissingFieldVetoCount(): number {
  return isAggressiveDeskRisk() ? 4 : 1;
}

/** Consecutive losses before desk pause veto. */
export function riskConsecutiveLossVeto(): number {
  return isAggressiveDeskRisk() ? 4 : 3;
}

/** Daily loss streak before dailyLossLimitHit flag. */
export function riskDailyLossStreakFlag(): number {
  return isAggressiveDeskRisk() ? 3 : 2;
}

/** Bear thesis reasons required to force SKIP. */
export function bearSkipReasonThreshold(): number {
  return isAggressiveDeskRisk() ? 4 : 3;
}

/** Bull thesis reasons required to advocate TRADE. */
export function bullTradeReasonThreshold(): number {
  return isAggressiveDeskRisk() ? 2 : 3;
}

export function engineAllowsWaitAsTrade(
  recommendation: TradeRecommendation,
  confidence: number,
): boolean {
  if (!isAggressiveDeskRisk()) return false;
  return recommendation === "wait" && confidence >= 52;
}

export function engineAllowsCoreFailureTrade(
  coreCheckFailure: boolean,
  confidence: number,
): boolean {
  if (!isAggressiveDeskRisk() || !coreCheckFailure) return false;
  return confidence >= 58;
}

export function engineDeltaWaitAsTradeOk(): boolean {
  return isAggressiveDeskRisk();
}
