import type { LearningEvaluationReport } from "@/lib/self-learning/types";
import type { TradeEvaluationResult } from "@/lib/self-learning/types";
import type { LearningSummary } from "./types";

export function buildLearningSummary(input: {
  report: LearningEvaluationReport | null;
  newEvaluations: TradeEvaluationResult[];
}): LearningSummary {
  const report = input.report;
  const board = report?.agentLeaderboard ?? [];
  const sorted = [...board].sort(
    (a, b) => b.prediction.hitRate - a.prediction.hitRate,
  );
  const topAgent = sorted[0]?.agentName ?? null;
  const weakestAgent = sorted[sorted.length - 1]?.agentName ?? null;

  const agentUpdates = board
    .filter((a) => a.prediction.totalCalls >= 2)
    .slice(0, 4)
    .map(
      (a) =>
        `${a.agentName}: ${a.prediction.hitRate}% hit (${a.overallGrade})`,
    );

  return {
    newEvaluations: input.newEvaluations.length,
    totalEvaluations: report?.totalEvaluations ?? input.newEvaluations.length,
    topAgent,
    weakestAgent,
    newRecommendations: report?.improvementRecommendations.length ?? 0,
    leaderboardSummary: topAgent
      ? `Top performer ${topAgent}; watch ${weakestAgent ?? "n/a"}`
      : "Insufficient evaluation history",
    agentUpdates,
  };
}
