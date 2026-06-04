import type { TradeRecommendation } from "@/lib/types/market";
import { isGovernanceAggressiveDisabled } from "@/lib/governance/governance-runtime";

export type DeskRiskProfile = "balanced" | "aggressive";

let activeProfile: DeskRiskProfile =
  process.env.DESK_RISK_PROFILE === "balanced" ? "balanced" : "aggressive";

export function getDeskRiskProfile(): DeskRiskProfile {
  return activeProfile;
}

export function setDeskRiskProfile(profile: DeskRiskProfile): void {
  activeProfile = profile;
}

export function applyDeskRiskProfile(profile?: DeskRiskProfile): DeskRiskProfile {
  if (profile) setDeskRiskProfile(profile);
  return getDeskRiskProfile();
}

export function isAggressiveDeskRisk(): boolean {
  if (isGovernanceAggressiveDisabled()) return false;
  return getDeskRiskProfile() === "aggressive";
}

export function committeeMinDataQualityScore(): number {
  return isAggressiveDeskRisk() ? 25 : 45;
}

export function riskIvHvFloor(): number {
  return isAggressiveDeskRisk() ? 1.05 : 1.15;
}

export function riskSdFloor(): number {
  return isAggressiveDeskRisk() ? 1.2 : 1.5;
}

export function riskMissingFieldVetoCount(): number {
  return isAggressiveDeskRisk() ? 4 : 1;
}

export function riskConsecutiveLossVeto(): number {
  return isAggressiveDeskRisk() ? 4 : 3;
}

export function riskDailyLossStreakFlag(): number {
  return isAggressiveDeskRisk() ? 3 : 2;
}

export function bearSkipReasonThreshold(): number {
  return isAggressiveDeskRisk() ? 4 : 3;
}

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
