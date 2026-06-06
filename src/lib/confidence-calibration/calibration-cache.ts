import type { ConfidenceCalibrationProfile } from "./types";

let cachedProfile: ConfidenceCalibrationProfile | null = null;

export function getCachedCalibrationProfile(): ConfidenceCalibrationProfile | null {
  return cachedProfile;
}

export function setCachedCalibrationProfile(
  profile: ConfidenceCalibrationProfile | null,
): void {
  cachedProfile = profile;
}
