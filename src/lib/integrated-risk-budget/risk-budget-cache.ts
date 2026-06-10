import type { RiskBudgetRecommendation } from "./types";

let cachedRecommendation: RiskBudgetRecommendation | null = null;

export function getCachedRiskBudgetRecommendation(): RiskBudgetRecommendation | null {
  return cachedRecommendation;
}

export function setCachedRiskBudgetRecommendation(
  recommendation: RiskBudgetRecommendation | null,
): void {
  cachedRecommendation = recommendation;
}
