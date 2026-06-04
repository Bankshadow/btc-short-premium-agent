import type { OperatorBehaviorAnalytics, OperatorDisciplineReport } from "./types";

export function buildOperatorDisciplineReport(
  analytics: OperatorBehaviorAnalytics,
): OperatorDisciplineReport {
  const s = analytics.operatorDisciplineScore;
  let grade: OperatorDisciplineReport["grade"] = "A";
  if (s < 50) grade = "D";
  else if (s < 65) grade = "C";
  else if (s < 80) grade = "B";

  const requireStrongerConfirmation =
    analytics.overrideCount >= 4 || analytics.incidentCandidate;
  const suggestCooldown =
    analytics.overridesAfterLossStreak >= 2 ||
    analytics.operatorDisciplineScore < 60;

  return {
    ...analytics,
    grade,
    requireStrongerConfirmation,
    suggestCooldown,
  };
}
