import { DIMENSION_LABELS } from "@/lib/trade-quality-score/config";
import type { ConfidenceCalibrationReport } from "@/lib/integrated-confidence-calibration/types";
import type { IntegratedStrategyHealthSnapshot } from "@/lib/integrated-strategy-health/types";
import type {
  TradeQualityDimensions,
  TradeQualityScore,
} from "@/lib/trade-quality-score/types";

export function buildOverconfidenceWarning(
  report: ConfidenceCalibrationReport,
): string | null {
  if (!report.overconfidenceDetected) return null;

  const worst = [...report.bucketStats]
    .filter((b) => b.overconfident && b.sampleCount > 0)
    .sort((a, b) => b.calibrationGap - a.calibrationGap)[0];

  if (worst) {
    return `Overconfidence in ${worst.label} bucket: stated ${worst.avgConfidence}% confidence vs ${worst.winRate}% win rate (gap +${worst.calibrationGap}%).`;
  }

  const topAgent = report.affectedAgents.find((a) => a.overconfident);
  if (topAgent) {
    return `Agent ${topAgent.agentName} overconfident — ${topAgent.avgStatedConfidence}% stated vs ${topAgent.actualWinRate}% win rate.`;
  }

  return report.confidenceAdjustmentRecommendation;
}

export function buildStrategyImprovementSuggestion(input: {
  latestScore: TradeQualityScore | null;
  weakestDimension: keyof TradeQualityDimensions | null;
  report: ConfidenceCalibrationReport;
  strategyHealth: IntegratedStrategyHealthSnapshot | null | undefined;
}): string | null {
  const parts: string[] = [];

  if (input.weakestDimension && input.latestScore) {
    const value = input.latestScore.dimensions[input.weakestDimension];
    if (value < 65) {
      parts.push(
        `Strengthen ${DIMENSION_LABELS[input.weakestDimension]} (avg ${value}/100 on recent closes).`,
      );
    } else if (input.latestScore.improvementSuggestion) {
      parts.push(input.latestScore.improvementSuggestion);
    } else if (input.latestScore.improvements[0]) {
      parts.push(input.latestScore.improvements[0]);
    }
  }

  const overStrategy = input.report.affectedStrategies.find((s) => s.overconfident);
  if (overStrategy) {
    parts.push(
      `Reduce stated confidence for ${overStrategy.strategyTag} — gap +${overStrategy.calibrationGap}% vs actual win rate.`,
    );
  }

  const healthWeakness = input.strategyHealth?.primaryReport?.biggestWeakness;
  if (healthWeakness) {
    parts.push(healthWeakness);
  }

  const healthNext = input.strategyHealth?.primaryReport?.nextAction;
  if (parts.length === 0 && healthNext) {
    parts.push(healthNext);
  }

  if (parts.length === 0 && input.report.sampleCount === 0) {
    return "Close more testnet trades with decisionLogId and AI confidence to measure quality and calibration.";
  }

  return parts.length > 0 ? parts.slice(0, 2).join(" ") : null;
}

export function averageDimensionScores(
  scores: TradeQualityScore[],
): Partial<Record<keyof TradeQualityDimensions, number>> {
  if (scores.length === 0) return {};
  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const score of scores) {
    for (const [key, value] of Object.entries(score.dimensions)) {
      totals[key] = (totals[key] ?? 0) + value;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  const result: Partial<Record<keyof TradeQualityDimensions, number>> = {};
  for (const key of Object.keys(totals)) {
    result[key as keyof TradeQualityDimensions] = Math.round(
      totals[key]! / counts[key]!,
    );
  }
  return result;
}
