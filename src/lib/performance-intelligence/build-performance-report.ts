import { analyzeAdaptationPerformance } from "@/lib/strategy-adaptation/analyze-performance";
import { buildStrategyRegistry } from "@/lib/strategy-registry/build-strategy-registry";
import type { PerformanceIntelligenceInput, PerformanceIntelligenceReport } from "./types";
import { PERFORMANCE_INTELLIGENCE_SAFETY_NOTICE } from "./types";
import { buildAiVersionSnapshot } from "./version-snapshot";
import {
  buildImprovementTrend,
  buildMonthlyPerformance,
  buildWeeklyPerformance,
} from "./aggregate-periods";
import {
  buildAgentContribution,
  buildCommitteeAccuracy,
  buildFalseSignalReport,
  buildHumanOverrideComparison,
  buildRiskManagerVetoQuality,
  buildWeightedCommitteeComparison,
} from "./build-metrics";
import {
  buildRuleImpact,
  buildStrategyChangeImpact,
  buildStrategyVersionPnl,
  buildVersionComparisons,
} from "./build-impact-slices";

export function buildPerformanceIntelligenceReport(
  input: PerformanceIntelligenceInput,
): PerformanceIntelligenceReport {
  const entries = input.entries;
  const orders = input.orders ?? [];
  const riskProfile = input.riskProfile ?? "balanced";
  const evaluations = input.storedEvaluations ?? [];

  const weeklyPerformance = buildWeeklyPerformance(entries, evaluations);
  const monthlyPerformance = buildMonthlyPerformance(entries, evaluations);
  const improvementTrend = buildImprovementTrend(
    weeklyPerformance,
    monthlyPerformance,
  );

  const adaptationReport = analyzeAdaptationPerformance({
    entries,
    orders,
    riskProfile,
    registry: buildStrategyRegistry({ entries, orders, riskProfile }),
  });

  const strict = adaptationReport.strictVsRelaxed.strict;
  const relaxed = adaptationReport.strictVsRelaxed.relaxed;

  const versions = buildAiVersionSnapshot({
    riskProfile,
    adaptiveAuditCount: input.adaptiveWeightingAudit?.length,
    persistedRegistry: input.persistedRegistry,
    ruleProposals: input.ruleProposals,
    governanceAuditCount: input.governanceAuditCount,
    governanceLastChangeAt: input.governanceLastChangeAt,
  });

  return {
    generatedAt: new Date().toISOString(),
    versions,
    improvementTrend,
    weeklyPerformance,
    monthlyPerformance,
    agentContribution: buildAgentContribution(entries, evaluations),
    committeeAccuracy: buildCommitteeAccuracy(entries),
    riskManagerVetoQuality: buildRiskManagerVetoQuality(entries),
    falseSignalReport: buildFalseSignalReport(entries, evaluations),
    ruleImpact: buildRuleImpact(entries, input.ruleProposals ?? []),
    strategyVersionPnl: buildStrategyVersionPnl(
      entries,
      orders,
      input.persistedRegistry,
    ),
    strategyChangeImpact: buildStrategyChangeImpact(
      entries,
      input.adaptationAudit ?? [],
    ),
    regimePerformance: adaptationReport.regimePerformance.map((r) => ({
      regime: r.regime,
      winRate: r.winRate,
      avgPnlPct: r.avgPnlPct,
      sampleSize: r.sampleSize,
    })),
    versionComparisons: buildVersionComparisons(
      weeklyPerformance,
      monthlyPerformance,
    ),
    strictVsRelaxed: {
      strictWinRate: strict.winRate,
      relaxedWinRate: relaxed.winRate,
      strictAvgPnl: strict.avgPnlPct,
      relaxedAvgPnl: relaxed.avgPnlPct,
      strictTrades: strict.trades,
      relaxedTrades: relaxed.trades,
      deltaWinRate: Number((relaxed.winRate - strict.winRate).toFixed(1)),
      summary:
        relaxed.trades > 0 && strict.trades > 0
          ? `Relaxed paper win rate ${relaxed.winRate}% vs strict ${strict.winRate}%.`
          : "Insufficient strict/relaxed paper samples for comparison.",
    },
    weightedVsOriginal: buildWeightedCommitteeComparison(
      input.adaptiveWeightingAudit ?? [],
    ),
    humanOverrideVsAi: buildHumanOverrideComparison(
      entries,
      input.operatorOverrideLog ?? [],
    ),
    safetyNotice: PERFORMANCE_INTELLIGENCE_SAFETY_NOTICE,
    analyticalOnly: true,
    cannotPlaceTrades: true,
    cannotApproveChanges: true,
  };
}
