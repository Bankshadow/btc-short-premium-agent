import { PROJECT_STRATEGIST_SAFETY } from "./config";

export function assertProjectStrategistSafety(): void {
  if (!PROJECT_STRATEGIST_SAFETY.cannotTrade) {
    throw new Error("Project strategist safety violation: trading disabled only.");
  }
  if (!PROJECT_STRATEGIST_SAFETY.cannotChangeLiveSettings) {
    throw new Error(
      "Project strategist safety violation: live setting changes disabled only.",
    );
  }
  if (!PROJECT_STRATEGIST_SAFETY.cannotApproveOwnSkillUpdates) {
    throw new Error(
      "Project strategist safety violation: self-approval must remain disabled.",
    );
  }
}
