import { getDeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { saveMissionRiskSettings } from "@/lib/mission-risk/mission-risk-store";
import type { MissionControllerRiskBudgetSnapshot } from "./types";

/** Auto-reduce desk risk when MVP 92 mission mode demands it — never raises risk. */
export async function applyMissionControllerRiskBudgetAdjustment(
  snapshot: MissionControllerRiskBudgetSnapshot,
): Promise<{ adjusted: boolean; from?: string; to?: string }> {
  const current = getDeskRiskProfile();
  const shouldReduce =
    snapshot.missionMode === "PAUSED" ||
    snapshot.missionMode === "COOLDOWN" ||
    snapshot.missionMode === "DEFENSIVE";

  if (shouldReduce && current === "aggressive") {
    await saveMissionRiskSettings({ deskRiskProfile: "balanced" });
    return { adjusted: true, from: "aggressive", to: "balanced" };
  }

  return { adjusted: false };
}
