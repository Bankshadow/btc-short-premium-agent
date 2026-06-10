import type { DailySelfReview } from "./types";

let cachedReview: DailySelfReview | null = null;
let cachedTomorrowPlan: string | null = null;

export function setCachedDailySelfReview(review: DailySelfReview): void {
  cachedReview = review;
  cachedTomorrowPlan = review.tomorrowPlan;
}

export function getCachedDailySelfReview(): DailySelfReview | null {
  return cachedReview;
}

export function getCachedTomorrowPlan(): string | null {
  return cachedTomorrowPlan;
}

export function getCachedSuggestedCursorTask(): string | null {
  return cachedReview?.suggestedCursorTask ?? null;
}
