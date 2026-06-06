import { getDeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { saveMissionRiskSettings } from "@/lib/mission-risk/mission-risk-store";
import type { MissionControllerResult } from "./types";

/** Auto-reduce desk risk when mission mode demands it — never raises risk. */
export async function applyMissionControllerRiskAdjustment(
  result: MissionControllerResult,
): Promise<{ adjusted: boolean; from?: string; to?: string }> {
  if (!result.canAutoReduceRisk) return { adjusted: false };

  const current = getDeskRiskProfile();
  const shouldReduce =
    result.mode === "PAUSED" ||
    result.mode === "RECOVERY" ||
    result.mode === "DEFENSIVE" ||
    result.recommendedRiskLevel === "CONSERVATIVE";

  if (shouldReduce && current === "aggressive") {
    await saveMissionRiskSettings({ deskRiskProfile: "balanced" });
    return { adjusted: true, from: "aggressive", to: "balanced" };
  }

  if (result.mode === "RECOVERY" && current === "balanced" && result.recommendedRiskLevel === "CONSERVATIVE") {
    /* balanced is already reduced enough for recovery */
    return { adjusted: false };
  }

  if (result.riskLevelRequiresApproval) {
    return { adjusted: false };
  }

  return { adjusted: false };
}
