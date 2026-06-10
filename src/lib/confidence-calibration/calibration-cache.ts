import type { ConfidenceCalibrationProfile } from "./types";

let cachedProfile: ConfidenceCalibrationProfile | null = null;
let cachedRecommendation: string | null = null;

export function getCachedCalibrationProfile(): ConfidenceCalibrationProfile | null {
  return cachedProfile;
}

export function getCachedCalibrationRecommendation(): string | null {
  return cachedRecommendation;
}

export function setCachedCalibrationProfile(
  profile: ConfidenceCalibrationProfile | null,
  recommendation?: string | null,
): void {
  cachedProfile = profile;
  if (recommendation !== undefined) {
    cachedRecommendation = recommendation;
  }
}
