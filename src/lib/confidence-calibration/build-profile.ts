import type { AgentEvaluation } from "@/lib/self-learning/types";
import {
  CONFIDENCE_BUCKETS,
  CONFIDENCE_CALIBRATION_MIN_BUCKET_SAMPLES,
  CONFIDENCE_CALIBRATION_OVERCONFIDENT_GAP,
} from "./config";
import { CONFIDENCE_CALIBRATION_SAFETY_NOTICE } from "./types";
import type {
  ConfidenceBucketPerformance,
  ConfidenceCalibrationProfile,
  ConfidenceCalibrationSample,
  OverconfidentAgentSummary,
} from "./types";

function bucketForConfidence(confidence: number) {
  return (
    CONFIDENCE_BUCKETS.find((b) => confidence >= b.min && confidence <= b.max) ??
    CONFIDENCE_BUCKETS[CONFIDENCE_BUCKETS.length - 1]
  );
}

function buildBucketPerformance(
  definition: (typeof CONFIDENCE_BUCKETS)[number],
  samples: ConfidenceCalibrationSample[],
): ConfidenceBucketPerformance {
  const bucketSamples = samples.filter((s) => {
    const c = s.confidenceBeforeTrade;
    return c >= definition.min && c <= definition.max;
  });
  const wins = bucketSamples.filter((s) => s.actualWin).length;
  const sampleCount = bucketSamples.length;
  const winRate =
    sampleCount > 0 ? Math.round((wins / sampleCount) * 1000) / 10 : 0;
  const avgConfidence =
    sampleCount > 0
      ? Math.round(
          bucketSamples.reduce((sum, s) => sum + s.confidenceBeforeTrade, 0) / sampleCount,
        )
      : Math.round((definition.min + definition.max) / 2);
  const avgPnlPct =
    sampleCount > 0
      ? Math.round(
          (bucketSamples.reduce((sum, s) => sum + s.pnlPct, 0) / sampleCount) * 100,
        ) / 100
      : 0;
  const calibrationGap =
    sampleCount > 0 ? Math.round((avgConfidence - winRate) * 10) / 10 : 0;
  const overconfident =
    sampleCount >= CONFIDENCE_CALIBRATION_MIN_BUCKET_SAMPLES &&
    calibrationGap >= CONFIDENCE_CALIBRATION_OVERCONFIDENT_GAP;

  return {
    bucketId: definition.id,
    label: definition.label,
    min: definition.min,
    max: definition.max,
    sampleCount,
    winRate,
    avgConfidence,
    avgPnlPct,
    calibrationGap,
    overconfident,
  };
}

function buildOverconfidentAgents(
  leaderboard: AgentEvaluation[],
): OverconfidentAgentSummary[] {
  return leaderboard
    .filter((a) => a.prediction.totalCalls >= 2)
    .map((a) => ({
      agentName: a.agentName,
      calibrationError: a.reasoning.confidenceCalibrationError,
      hitRate: a.prediction.hitRate,
      totalCalls: a.prediction.totalCalls,
      downweightRecommended: a.reasoning.confidenceCalibrationError >= 0.35,
    }))
    .filter((a) => a.downweightRecommended)
    .sort((a, b) => b.calibrationError - a.calibrationError);
}

export function buildConfidenceCalibrationProfile(input: {
  samples: ConfidenceCalibrationSample[];
  agentLeaderboard?: AgentEvaluation[];
}): ConfidenceCalibrationProfile {
  const buckets = CONFIDENCE_BUCKETS.map((def) => buildBucketPerformance(def, input.samples));
  const overconfidentBuckets = buckets.filter((b) => b.overconfident);
  const globalOverconfidenceGap =
    overconfidentBuckets.length > 0
      ? Math.round(
          overconfidentBuckets.reduce((sum, b) => sum + b.calibrationGap, 0) /
            overconfidentBuckets.length,
        )
      : 0;

  const highBucket = buckets.find((b) => b.bucketId === "80-100");
  const gapPenalty = Math.max(0, globalOverconfidenceGap / 100);
  const highPenalty =
    highBucket?.overconfident && highBucket.sampleCount >= CONFIDENCE_CALIBRATION_MIN_BUCKET_SAMPLES
      ? Math.max(0, highBucket.calibrationGap / 100)
      : 0;
  const penalty = Math.max(gapPenalty, highPenalty);
  const recommendedSizeMultiplier = Math.max(0.5, Math.min(1, 1 - penalty));
  const recommendedCommitteeMultiplier = recommendedSizeMultiplier;

  const overconfidentAgents = buildOverconfidentAgents(input.agentLeaderboard ?? []);

  const headline =
    highBucket && highBucket.sampleCount >= CONFIDENCE_CALIBRATION_MIN_BUCKET_SAMPLES
      ? `AI confidence ${highBucket.label} → win rate actually ${highBucket.winRate}%`
      : input.samples.length > 0
        ? `${input.samples.length} calibrated trade sample(s) — building bucket curve`
        : "No resolved trades with confidence yet — calibration pending";

  return {
    generatedAt: new Date().toISOString(),
    totalSamples: input.samples.length,
    buckets,
    globalOverconfidenceGap,
    recommendedSizeMultiplier: Number(recommendedSizeMultiplier.toFixed(3)),
    recommendedCommitteeMultiplier: Number(recommendedCommitteeMultiplier.toFixed(3)),
    overconfidentAgents,
    headline,
    safetyNotice: CONFIDENCE_CALIBRATION_SAFETY_NOTICE,
    canReduceRiskAutomatically: true,
    cannotIncreaseLiveRisk: true,
  };
}

export function findBucketForConfidence(
  profile: ConfidenceCalibrationProfile | null,
  confidence: number,
): ConfidenceBucketPerformance | null {
  if (!profile) return null;
  const def = bucketForConfidence(confidence);
  return profile.buckets.find((b) => b.bucketId === def.id) ?? null;
}
