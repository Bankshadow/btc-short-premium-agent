import type { EvidenceQualityLevel } from "./types";
import { EVIDENCE_QUALITY_REQUIRED } from "./types";

export function resolveEvidenceQualityLevel(input: {
  validEvidenceCount: number;
  invalidEvidenceCount: number;
  evidenceConfidence: number;
}): EvidenceQualityLevel {
  const total = input.validEvidenceCount + input.invalidEvidenceCount;
  if (total === 0) return "INSUFFICIENT";
  if (input.invalidEvidenceCount === 0 && input.evidenceConfidence >= 95) {
    return "GOOD";
  }
  if (
    input.validEvidenceCount >= EVIDENCE_QUALITY_REQUIRED &&
    input.invalidEvidenceCount === 0 &&
    input.evidenceConfidence >= 90
  ) {
    return "GOOD";
  }
  return "POOR";
}

export function resolveReadinessForStrategyReview(input: {
  validEvidenceCount: number;
  invalidEvidenceCount: number;
  evidenceConfidence: number;
  evidenceQualityLevel: EvidenceQualityLevel;
}): boolean {
  if (input.evidenceQualityLevel !== "GOOD") return false;
  return (
    input.validEvidenceCount >= EVIDENCE_QUALITY_REQUIRED &&
    input.invalidEvidenceCount === 0 &&
    input.evidenceConfidence >= 90
  );
}

export function resolveBlocksStrategyHealthReview(input: {
  evidenceQualityLevel: EvidenceQualityLevel;
  readinessForStrategyReview: boolean;
  invalidEvidenceCount: number;
}): boolean {
  if (input.evidenceQualityLevel === "POOR") return true;
  if (input.invalidEvidenceCount > 0) return true;
  return !input.readinessForStrategyReview;
}

export function resolveEvidenceBlockReason(input: {
  evidenceQualityLevel: EvidenceQualityLevel;
  readinessForStrategyReview: boolean;
  invalidEvidenceCount: number;
  validEvidenceCount: number;
  topMissingField: string | null;
}): string | null {
  if (input.evidenceQualityLevel === "INSUFFICIENT") {
    return `${input.validEvidenceCount} valid evidence trade(s) — need ${EVIDENCE_QUALITY_REQUIRED} complete trades before strategy review.`;
  }
  if (input.invalidEvidenceCount > 0) {
    const fieldHint = input.topMissingField
      ? ` Most common gap: ${input.topMissingField}.`
      : "";
    return `${input.invalidEvidenceCount} completed trade(s) fail evidence quality — excluded from performance trust.${fieldHint}`;
  }
  if (!input.readinessForStrategyReview) {
    return "Evidence quality insufficient — strategy health review blocked until all completed trades pass validation.";
  }
  return null;
}
