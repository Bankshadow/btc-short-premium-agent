import type { RiskBudgetResult } from "@/lib/risk-budget-optimizer/types";
import type { RealTimeRiskReport } from "./types";

export function applyRealTimeRiskToBudget(
  budget: RiskBudgetResult,
  report: RealTimeRiskReport,
): RiskBudgetResult {
  if (!report.blockNewTrades && report.riskStatus === "SAFE") {
    return budget;
  }

  const reasons = [...budget.sizeReductionReasons];
  if (report.blockNewTrades) {
    reasons.push(`Real-time risk ${report.riskStatus} — live entries blocked.`);
  }
  for (const action of report.recommendedActions) {
    if (!reasons.includes(action)) reasons.push(action);
  }

  return {
    ...budget,
    liveTradingAllowed: budget.liveTradingAllowed && !report.blockNewTrades,
    blockReasons:
      report.blockNewTrades && budget.liveTradingAllowed
        ? [
            ...budget.blockReasons,
            `Real-time risk ${report.riskStatus}`,
            ...report.triggeredLimits.map((l) => `Limit: ${l}`),
          ]
        : budget.blockReasons,
    recommendedRiskPct: report.blockIncreaseExposure
      ? Math.min(budget.recommendedRiskPct, budget.recommendedRiskPct * 0.5)
      : budget.recommendedRiskPct,
    sizeReductionReasons: reasons,
  };
}
