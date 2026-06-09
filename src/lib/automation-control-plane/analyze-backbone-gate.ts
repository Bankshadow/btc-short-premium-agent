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
];

export function isLiveScalingBackboneBlocker(message: string): boolean {
  return LIVE_SCALING_BACKBONE_PATTERNS.some((pattern) => pattern.test(message));
}

export function isLiveScalingAnalyzeFailureError(error: string): boolean {
  return isLiveScalingBackboneBlocker(error);
}

export function getOperationalBackboneBlockers(
  health: DeskBackboneHealth,
): string[] {
  if (!isTestnetPrimaryAutomation()) return health.writeBlockers;
  return health.writeBlockers.filter((b) => !isLiveScalingBackboneBlocker(b));
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
