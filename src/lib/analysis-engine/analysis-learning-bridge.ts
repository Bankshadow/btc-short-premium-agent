import type { AnalysisContext } from "./analysis-state";
import type { AnalysisLearningImpact } from "./analysis-result";

export function buildAnalysisLearningImpact(
  context: AnalysisContext,
): AnalysisLearningImpact {
  const pending = context.learningRecords.filter(
    (r) => r.status === "PENDING_REVIEW" || r.status === "REFLECTION_READY",
  );
  const learned = context.learningRecords.filter((r) => r.status === "LEARNED");

  let headline: string | null = null;
  if (pending.length > 0) {
    headline = `${pending.length} trade(s) pending learning review`;
  } else if (learned.length > 0) {
    headline = `${learned.length} learned record(s) on file`;
  }

  return {
    pendingReviewCount: pending.length,
    learnedCount: learned.length,
    headline,
  };
}

export function linkLearningToAnalysisRun(input: {
  context: AnalysisContext;
  decisionLogId: string;
}): string[] {
  return input.context.learningRecords
    .filter((r) => r.decisionLogId === input.decisionLogId)
    .map((r) => r.learningRecordId);
}
