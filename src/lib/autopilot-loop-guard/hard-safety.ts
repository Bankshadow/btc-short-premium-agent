import type { HardSafetyCheckInput, HardSafetyCheckResult } from "./types";

export function checkOrderHardSafety(
  input: HardSafetyCheckInput,
): HardSafetyCheckResult {
  if (!input.doubleConfirm) {
    return {
      allowed: false,
      reason: "Double confirm required — loop guard blocks bypass.",
      violation: "NO_DOUBLE_CONFIRM",
    };
  }

  if (input.blindRetry) {
    return {
      allowed: false,
      reason: "Blind order retry blocked — review failure before retrying.",
      violation: "BLIND_RETRY",
    };
  }

  const submitted = input.submittedPreviewIds ?? [];
  if (submitted.includes(input.previewId)) {
    return {
      allowed: false,
      reason: `Duplicate testnet order blocked — preview ${input.previewId} already submitted.`,
      violation: "DUPLICATE_ORDER",
    };
  }

  const fingerprint = input.previewFingerprint;
  const recent = input.recentPreviewFingerprints ?? [];
  if (fingerprint && recent.includes(fingerprint)) {
    return {
      allowed: false,
      reason: `Duplicate preview blocked — ${input.symbol} ${input.side} already queued this cycle.`,
      violation: "DUPLICATE_PREVIEW",
    };
  }

  return {
    allowed: true,
    reason: "Hard safety checks passed.",
    violation: "NONE",
  };
}
