import type { CommitteeRecommendation } from "@/lib/parallel-task-runner/types";

export function computeAiConfidence(input: {
  strategyHealthScore?: number | null;
  tradeAllowed?: boolean;
  committeeRecommendation?: CommitteeRecommendation | null;
  dataTrustScore?: number | null;
  dataTrustGrade?: string | null;
  step5Confidence?: number | null;
  committeeConfidence?: number | null;
  calibrationPenalty?: number | null;
}): number {
  const parts: number[] = [];

  if (input.step5Confidence != null) {
    parts.push(clamp(input.step5Confidence));
  }
  if (input.committeeConfidence != null) {
    parts.push(clamp(input.committeeConfidence));
  }
  if (input.strategyHealthScore != null) {
    parts.push(clamp(input.strategyHealthScore));
  }
  if (input.dataTrustScore != null) {
    parts.push(clamp(input.dataTrustScore));
  } else if (input.dataTrustGrade) {
    const gradeScore =
      input.dataTrustGrade === "A"
        ? 85
        : input.dataTrustGrade === "B"
          ? 70
          : input.dataTrustGrade === "C"
            ? 55
            : input.dataTrustGrade === "D"
              ? 35
              : 50;
    parts.push(gradeScore);
  }

  let base = parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : 50;

  if (input.committeeRecommendation === "PAUSE_AND_REVIEW") base -= 25;
  if (input.committeeRecommendation === "IMPLEMENT_FOLLOW_UP") base -= 5;
  if (input.tradeAllowed === false) base -= 20;
  if (input.calibrationPenalty != null && input.calibrationPenalty > 0) {
    base -= Math.min(25, Math.round(input.calibrationPenalty));
  }

  return clamp(Math.round(base));
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, n));
}
