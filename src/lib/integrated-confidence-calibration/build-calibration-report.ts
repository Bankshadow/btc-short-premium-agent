import {
  CONFIDENCE_BUCKETS,
  CONFIDENCE_CALIBRATION_MIN_BUCKET_SAMPLES,
  CONFIDENCE_CALIBRATION_OVERCONFIDENT_GAP,
} from "@/lib/confidence-calibration/config";
import { buildConfidenceCalibrationProfile } from "@/lib/confidence-calibration/build-profile";
import type { ConfidenceBucketPerformance } from "@/lib/confidence-calibration/types";
import type {
  AffectedAgentCalibration,
  AffectedStrategyCalibration,
  ConfidenceCalibrationReport,
  IntegratedCalibrationSample,
} from "./types";

const UNDERCONFIDENT_GAP = -8;

function buildBucketStats(
  samples: IntegratedCalibrationSample[],
): ConfidenceBucketPerformance[] {
  return CONFIDENCE_BUCKETS.map((def) => {
    const bucketSamples = samples.filter(
      (s) =>
        s.confidenceBeforeTrade >= def.min &&
        s.confidenceBeforeTrade <= def.max,
    );
    const wins = bucketSamples.filter((s) => s.actualWin).length;
    const sampleCount = bucketSamples.length;
    const winRate =
      sampleCount > 0 ? Math.round((wins / sampleCount) * 1000) / 10 : 0;
    const avgConfidence =
      sampleCount > 0
        ? Math.round(
            bucketSamples.reduce((sum, s) => sum + s.confidenceBeforeTrade, 0) /
              sampleCount,
          )
        : Math.round((def.min + def.max) / 2);
    const avgPnlPct =
      sampleCount > 0
        ? Math.round(
            (bucketSamples.reduce((sum, s) => sum + s.pnlPct, 0) / sampleCount) *
              100,
          ) / 100
        : 0;
    const calibrationGap =
      sampleCount > 0 ? Math.round((avgConfidence - winRate) * 10) / 10 : 0;
    const overconfident =
      sampleCount >= CONFIDENCE_CALIBRATION_MIN_BUCKET_SAMPLES &&
      calibrationGap >= CONFIDENCE_CALIBRATION_OVERCONFIDENT_GAP;

    return {
      bucketId: def.id,
      label: def.label,
      min: def.min,
      max: def.max,
      sampleCount,
      winRate,
      avgConfidence,
      avgPnlPct,
      calibrationGap,
      overconfident,
    };
  });
}

function aggregateByKey(
  samples: IntegratedCalibrationSample[],
  keyFn: (s: IntegratedCalibrationSample) => string | null,
): Map<string, IntegratedCalibrationSample[]> {
  const map = new Map<string, IntegratedCalibrationSample[]>();
  for (const sample of samples) {
    const key = keyFn(sample);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(sample);
    map.set(key, list);
  }
  return map;
}

function buildAffectedAgents(
  samples: IntegratedCalibrationSample[],
): AffectedAgentCalibration[] {
  const byAgent = aggregateByKey(samples, (s) => s.sourceAgent);
  return [...byAgent.entries()]
    .map(([agentName, rows]) => {
      const wins = rows.filter((r) => r.actualWin).length;
      const avgStatedConfidence = Math.round(
        rows.reduce((s, r) => s + r.confidenceBeforeTrade, 0) / rows.length,
      );
      const actualWinRate = Math.round((wins / rows.length) * 1000) / 10;
      const calibrationGap = Math.round((avgStatedConfidence - actualWinRate) * 10) / 10;
      const overconfident = calibrationGap >= CONFIDENCE_CALIBRATION_OVERCONFIDENT_GAP;
      const underconfident = calibrationGap <= UNDERCONFIDENT_GAP;
      return {
        agentName,
        sampleCount: rows.length,
        avgStatedConfidence,
        actualWinRate,
        calibrationGap,
        overconfident,
        underconfident,
        downweightRecommended: overconfident && rows.length >= 2,
      };
    })
    .sort((a, b) => b.calibrationGap - a.calibrationGap);
}

function buildAffectedStrategies(
  samples: IntegratedCalibrationSample[],
): AffectedStrategyCalibration[] {
  const byStrategy = aggregateByKey(samples, (s) => s.strategyTag);
  return [...byStrategy.entries()]
    .map(([strategyTag, rows]) => {
      const wins = rows.filter((r) => r.actualWin).length;
      const avgStatedConfidence = Math.round(
        rows.reduce((s, r) => s + r.confidenceBeforeTrade, 0) / rows.length,
      );
      const actualWinRate = Math.round((wins / rows.length) * 1000) / 10;
      const calibrationGap = Math.round((avgStatedConfidence - actualWinRate) * 10) / 10;
      const regimes = rows
        .map((r) => r.marketRegime)
        .filter((r): r is string => Boolean(r));
      const regimeCounts = new Map<string, number>();
      for (const r of regimes) {
        regimeCounts.set(r, (regimeCounts.get(r) ?? 0) + 1);
      }
      const dominantRegime =
        [...regimeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return {
        strategyTag,
        sampleCount: rows.length,
        avgStatedConfidence,
        actualWinRate,
        calibrationGap,
        overconfident: calibrationGap >= CONFIDENCE_CALIBRATION_OVERCONFIDENT_GAP,
        underconfident: calibrationGap <= UNDERCONFIDENT_GAP,
        dominantRegime,
      };
    })
    .sort((a, b) => b.calibrationGap - a.calibrationGap);
}

function buildRecommendation(input: {
  overconfidenceDetected: boolean;
  underconfidenceDetected: boolean;
  recommendedSizeMultiplier: number;
  globalGap: number;
  sampleCount: number;
}): string {
  if (input.sampleCount === 0) {
    return "Collect closed testnet trades with decisionLogId and confidence to calibrate AI.";
  }
  if (input.overconfidenceDetected) {
    return `Reduce testnet size to ×${input.recommendedSizeMultiplier.toFixed(2)} — AI stated confidence exceeds actual win rate (gap ${input.globalGap}%). Live risk cannot increase automatically.`;
  }
  if (input.underconfidenceDetected) {
    return "AI may be underconfident on winning setups — review but do not increase live size without operator approval.";
  }
  return "Confidence aligned with outcomes — no size reduction recommended.";
}

export function buildConfidenceCalibrationReport(input: {
  samples: IntegratedCalibrationSample[];
}): ConfidenceCalibrationReport {
  const bucketStats = buildBucketStats(input.samples);
  const overconfidenceDetected = bucketStats.some((b) => b.overconfident);
  const underconfidenceDetected = bucketStats.some(
    (b) =>
      b.sampleCount >= CONFIDENCE_CALIBRATION_MIN_BUCKET_SAMPLES &&
      b.calibrationGap <= UNDERCONFIDENT_GAP,
  );

  const profile = buildConfidenceCalibrationProfile({
    samples: input.samples,
  });

  const overconfidentBuckets = bucketStats.filter((b) => b.overconfident);
  const globalGap =
    overconfidentBuckets.length > 0
      ? Math.round(
          overconfidentBuckets.reduce((s, b) => s + b.calibrationGap, 0) /
            overconfidentBuckets.length,
        )
      : 0;

  return {
    reportId: `icc-report-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    sampleCount: input.samples.length,
    bucketStats,
    overconfidenceDetected,
    underconfidenceDetected,
    confidenceAdjustmentRecommendation: buildRecommendation({
      overconfidenceDetected,
      underconfidenceDetected,
      recommendedSizeMultiplier: profile.recommendedSizeMultiplier,
      globalGap,
      sampleCount: input.samples.length,
    }),
    recommendedSizeMultiplier: profile.recommendedSizeMultiplier,
    affectedAgents: buildAffectedAgents(input.samples),
    affectedStrategies: buildAffectedStrategies(input.samples),
    autoAgentWeightChangeAllowed: false,
    cannotIncreaseLiveRisk: true,
  };
}

export function buildConfidenceCalibrationProfileFromSamples(
  samples: IntegratedCalibrationSample[],
) {
  return buildConfidenceCalibrationProfile({ samples });
}

export function strategyCalibrationByTag(
  report: ConfidenceCalibrationReport,
): Map<string, AffectedStrategyCalibration> {
  return new Map(report.affectedStrategies.map((s) => [s.strategyTag, s]));
}
