import { resolveAiNextActionFromMicroLiveReadiness } from "@/lib/micro-live-readiness/map-mission-action";
import { utcDateKey } from "@/lib/daily-self-review/build-daily-self-review";
import type { IntegratedDailySelfReviewSnapshot } from "./types";

/** Prefer today's integrated daily review tomorrow plan for AI Status nextAction. */
export function resolveAiNextActionFromDailyReview(
  dailyReview: IntegratedDailySelfReviewSnapshot | null | undefined,
  fallback: string,
): string {
  const review = dailyReview?.review;
  if (!review?.tomorrowPlan) return fallback;
  const today = utcDateKey();
  if (review.date !== today) return fallback;
  return review.tomorrowPlan.slice(0, 280);
}

export function resolveAiNextActionChain(input: {
  microLiveReadiness: Parameters<typeof resolveAiNextActionFromMicroLiveReadiness>[0];
  dailyReview: IntegratedDailySelfReviewSnapshot | null | undefined;
  integratedFallback: string;
}): string {
  const fromDaily = resolveAiNextActionFromDailyReview(
    input.dailyReview,
    input.integratedFallback,
  );
  return resolveAiNextActionFromMicroLiveReadiness(input.microLiveReadiness, fromDaily);
}
