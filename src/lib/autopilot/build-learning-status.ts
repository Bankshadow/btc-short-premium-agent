import { buildAgentScoreboard } from "@/lib/journal/agent-scoreboard";
import { buildCapitalReport } from "@/lib/capital/build-capital-report";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import { buildValidationReport } from "@/lib/validation/build-validation-report";
import { buildStrategyPerformanceMatrix } from "@/lib/validation/strategy-performance";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  filterProductionEntries,
  filterProductionOrders,
} from "@/lib/journal/production-filter";
import type { LearningStatus } from "./types";

export function buildLearningStatus(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  riskProfile: DeskRiskProfile;
  latestAnalysis?: AnalyzeApiResponse | null;
}): LearningStatus {
  const entries = filterProductionEntries(input.entries);
  const orders = filterProductionOrders(input.orders);
  const resolved = entries.filter((e) => e.outcomeStatus === "RESOLVED");
  const closedPaper = orders.filter((o) => o.status === "CLOSED");
  const openPaper = orders.filter((o) => o.status === "OPEN");
  const shadowTrades = orders.filter((o) => o.paperMode === "RELAXED_PAPER");

  const matrix = buildStrategyPerformanceMatrix(
    entries,
    orders,
    input.riskProfile,
  );
  const strategySampleSize = matrix.reduce(
    (sum, row) => sum + row.resolvedSignals,
    0,
  );
  const minRequired = VALIDATION_THRESHOLDS.minSignalsForActive;

  const scoreboard = buildAgentScoreboard(entries);
  const validation = buildValidationReport({
    entries,
    orders,
    riskProfile: input.riskProfile,
    latestAnalysis: input.latestAnalysis,
  });
  const capital = buildCapitalReport({
    entries,
    orders,
    riskProfile: input.riskProfile,
    latestAnalysis: input.latestAnalysis,
  });

  const agentScoreboardReady = scoreboard.totalResolved >= 3;
  const validationReady = strategySampleSize >= minRequired;
  const capitalScalingReady = capital.scalePermission.allowed;

  let label = "Learning loop active";
  let detail = `${resolved.length} resolved outcomes · ${strategySampleSize} strategy samples`;

  if (resolved.length === 0) {
    label = "AI is not learning yet — no resolved outcomes";
    detail =
      "Run the first desk cycle and resolve paper outcomes to build trade memory.";
  } else if (strategySampleSize < minRequired) {
    label = `Need ${minRequired} resolved samples`;
    detail = `${strategySampleSize}/${minRequired} samples — keep paper trading and resolving outcomes.`;
  } else if (validationReady && capitalScalingReady) {
    label = "Strategy validation ready";
    detail = "Sample size and capital scaling checks passed on paper data.";
  }

  return {
    decisionLogsCount: entries.length,
    resolvedOutcomesCount: resolved.length,
    paperTradesCount: closedPaper.length + openPaper.length,
    shadowTradesCount: shadowTrades.length,
    strategySampleSize,
    minRequiredSampleSize: minRequired,
    agentScoreboardReady,
    validationReady,
    capitalScalingReady,
    label,
    detail,
  };
}
