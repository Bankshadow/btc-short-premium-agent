import { isTestnetPrimaryAutomation } from "./primary-mode";
import type { DeskBackboneHealth } from "@/lib/data-backbone/types";

const LIVE_SCALING_BACKBONE_PATTERNS = [
  /live readiness/i,
  /resolved paper/i,
  /paper trade history/i,
  /exchange api keys/i,
  /supabase sync/i,
  /alert channel/i,
  /telegram/i,
  /discord/i,
  /webhook configured/i,
  /governance audit/i,
  /warehouse-backed/i,
  /validation sample/i,
  /decision log/i,
  /partial derivatives/i,
  /combination read/i,
  /derivatives data/i,
  /exchange not configured/i,
  /live connectivity unknown/i,
];

/** Advisory data-quality lockout must not block testnet-perp analyze cycles. */
const TESTNET_ADVISORY_ANALYZE_FAILURE = /data quality \d+\/100 below lockout/i;

export function isLiveScalingBackboneBlocker(message: string): boolean {
  return LIVE_SCALING_BACKBONE_PATTERNS.some((pattern) => pattern.test(message));
}

export function isDataQualityAnalyzeFailureError(error: string): boolean {
  return TESTNET_ADVISORY_ANALYZE_FAILURE.test(error);
}

export function isRecoverableDeskAnalyzeFailureError(error: string): boolean {
  return (
    isLiveScalingAnalyzeFailureError(error) ||
    isDataQualityAnalyzeFailureError(error)
  );
}

export function isLiveScalingAnalyzeFailureError(error: string): boolean {
  return isLiveScalingBackboneBlocker(error);
}

function isTestnetAdvisoryBackboneBlocker(message: string): boolean {
  return (
    isLiveScalingBackboneBlocker(message) ||
    isDataQualityAnalyzeFailureError(message)
  );
}

export function getOperationalBackboneBlockers(
  health: DeskBackboneHealth,
): string[] {
  if (!isTestnetPrimaryAutomation()) return health.writeBlockers;
  return health.writeBlockers.filter((b) => !isTestnetAdvisoryBackboneBlocker(b));
}

/** Whether DESK_ANALYZE should hard-stop on persisted backbone health. */
export function shouldBlockDeskAnalyzeOnBackbone(input: {
  healthy: boolean;
  health: DeskBackboneHealth | null;
  force?: boolean;
}): boolean {
  if (input.force || input.healthy || !input.health) return false;
  if (!isTestnetPrimaryAutomation()) return true;
  return getOperationalBackboneBlockers(input.health).length > 0;
}
