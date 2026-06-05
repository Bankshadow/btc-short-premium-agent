import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import {
  aggregateAgentLeaderboard,
  extractAgentWeaknesses,
} from "./aggregate-agents";
import { buildRegimeEvaluations } from "./evaluate-regime";
import { buildStrategyEvaluations } from "./evaluate-strategy";
import { evaluateClosedTrade } from "./evaluate-entry";
import { generateImprovementRecommendations } from "./generate-improvements";
import type { LearningEvaluationReport, TradeEvaluationResult } from "./types";
import { SELF_LEARNING_SAFETY_NOTICE } from "./types";

export function buildLearningEvaluationReport(input: {
  entries: DecisionLogEntry[];
  storedResults?: TradeEvaluationResult[];
}): LearningEvaluationReport {
  const resolved = input.entries.filter((e) => e.outcomeStatus === "RESOLVED");

  let results = input.storedResults ?? [];
  if (results.length === 0 && resolved.length > 0) {
    results = resolved
      .map((entry) =>
        evaluateClosedTrade({ entry, source: "manual_resolve" }),
      )
      .filter((r): r is TradeEvaluationResult => r != null);
  }

  const leaderboard = aggregateAgentLeaderboard(results);
  const strategyReports = buildStrategyEvaluations(input.entries, results);
  const regimeReports = buildRegimeEvaluations(input.entries, results);

  return {
    generatedAt: new Date().toISOString(),
    totalEvaluations: results.length,
    agentLeaderboard: leaderboard,
    agentWeaknesses: extractAgentWeaknesses(leaderboard),
    strategyReports,
    regimeReports,
    recentResults: results.slice(0, 12),
    improvementRecommendations: generateImprovementRecommendations({
      leaderboard,
      strategyReports,
      regimeReports,
    }),
    safetyNotice: SELF_LEARNING_SAFETY_NOTICE,
    cannotAutoChangeLive: true,
    proposalsOnly: true,
  };
}
