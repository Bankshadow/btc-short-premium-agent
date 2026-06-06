import type { TradeQualityGrade, TradeQualityScore, TradeQualitySummary } from "./types";
import { gradeToNumeric } from "./score-trade";
import type { TradeQualityDimensions } from "./types";

function deriveAvgGrade(scores: TradeQualityScore[]): TradeQualityGrade | null {
  if (scores.length === 0) return null;
  const avg = scores.reduce((sum, s) => sum + gradeToNumeric(s.grade), 0) / scores.length;
  if (avg >= 90) return "A";
  if (avg >= 75) return "B";
  if (avg >= 60) return "C";
  if (avg >= 45) return "D";
  return "F";
}

export function buildTradeQualitySummary(
  scores: TradeQualityScore[],
  limit = 8,
): TradeQualitySummary {
  const recent = scores.slice(0, limit);
  const gradeCounts: Record<TradeQualityGrade, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    F: 0,
  };
  for (const s of scores) gradeCounts[s.grade] += 1;

  const avgCompositeScore =
    scores.length > 0
      ? Math.round(
          scores.reduce((sum, s) => sum + s.compositeScore, 0) / scores.length,
        )
      : 0;

  let weakestDimension: keyof TradeQualityDimensions | null = null;
  if (scores.length > 0) {
    const totals: Record<keyof TradeQualityDimensions, number> = {
      setupQuality: 0,
      entryQuality: 0,
      riskReward: 0,
      executionQuality: 0,
      exitQuality: 0,
      ruleCompliance: 0,
      aiReasoningQuality: 0,
    };
    for (const s of scores) {
      for (const key of Object.keys(totals) as (keyof TradeQualityDimensions)[]) {
        totals[key] += s.dimensions[key];
      }
    }
    weakestDimension = (Object.keys(totals) as (keyof TradeQualityDimensions)[]).sort(
      (a, b) => totals[a] / scores.length - totals[b] / scores.length,
    )[0];
  }

  const avgGrade = deriveAvgGrade(scores);
  const headline =
    scores.length > 0
      ? `Avg trade quality ${avgCompositeScore}/100 (${avgGrade ?? "—"}) across ${scores.length} scored trade(s)`
      : "No trade quality scores yet — close trades to grade decision quality.";

  return {
    sampleCount: scores.length,
    avgCompositeScore,
    avgGrade,
    gradeCounts,
    recent,
    weakestDimension,
    headline,
  };
}
