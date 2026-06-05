import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { runLearningReport } from "@/lib/self-learning/run-evaluation";
import type { TradeEvaluationResult } from "@/lib/self-learning/types";
import { loadAdaptiveWeightingSettings } from "./settings";
import type { AdaptiveWeightingAnalyzePayload } from "./types";

export function buildAdaptiveWeightingPayload(input: {
  entries: DecisionLogEntry[];
  storedResults?: TradeEvaluationResult[];
}): AdaptiveWeightingAnalyzePayload {
  const settings = loadAdaptiveWeightingSettings();
  const report = runLearningReport(input.entries, input.storedResults);
  const resolved = input.entries.filter((e) => e.outcomeStatus === "RESOLVED");

  return {
    settings,
    agentLeaderboard: report.agentLeaderboard,
    totalResolvedTrades: resolved.length,
  };
}
