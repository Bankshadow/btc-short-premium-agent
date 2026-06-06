import { CONFIDENCE_CALIBRATION_MIN_BUCKET_SAMPLES } from "./config";
import { findBucketForConfidence } from "./build-profile";
import type { ConfidenceCalibrationProfile } from "./types";

/** Calibrated confidence — never above raw (cannot increase trust automatically). */
export function applyCalibratedConfidence(
  rawConfidence: number,
  profile: ConfidenceCalibrationProfile | null,
): number {
  const raw = clamp(rawConfidence);
  if (!profile) return raw;

  const bucket = findBucketForConfidence(profile, raw);
  if (
    !bucket ||
    bucket.sampleCount < CONFIDENCE_CALIBRATION_MIN_BUCKET_SAMPLES ||
    bucket.calibrationGap <= 0
  ) {
    return raw;
  }

  const adjusted = Math.min(raw, bucket.winRate);
  return clamp(adjusted);
}

/** Size multiplier — never above 1.0 (cannot increase live risk). */
export function resolveCalibrationSizeMultiplier(
  rawConfidence: number,
  profile: ConfidenceCalibrationProfile | null,
): number {
  if (!profile) return 1;
  const bucket = findBucketForConfidence(profile, rawConfidence);
  let mult = profile.recommendedSizeMultiplier;
  if (
    bucket &&
    bucket.sampleCount >= CONFIDENCE_CALIBRATION_MIN_BUCKET_SAMPLES &&
    bucket.overconfident
  ) {
    const bucketMult = Math.max(0.5, 1 - bucket.calibrationGap / 100);
    mult = Math.min(mult, bucketMult);
  }
  return Math.max(0.5, Math.min(1, mult));
}

/** Committee trade score adjustment — only reduces score. */
export function applyCommitteeCalibration(
  tradeScore: number,
  profile: ConfidenceCalibrationProfile | null,
  rawConfidence?: number | null,
): number {
  if (!profile || tradeScore <= 0) return tradeScore;
  const mult = resolveCalibrationSizeMultiplier(rawConfidence ?? tradeScore, profile);
  if (mult >= 1) return tradeScore;
  return Number((tradeScore * mult).toFixed(3));
}

export function calibrationPenaltyPoints(
  rawConfidence: number,
  profile: ConfidenceCalibrationProfile | null,
): number {
  const calibrated = applyCalibratedConfidence(rawConfidence, profile);
  return Math.max(0, rawConfidence - calibrated);
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}
