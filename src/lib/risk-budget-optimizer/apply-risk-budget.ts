import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { OrderTicket } from "@/lib/trade-control/trade-control-types";
import type { RiskBudgetResult } from "./types";

export function resolveRiskBudgetSizePct(
  data: AnalyzeApiResponse,
  fallbackPct: number,
): number {
  const budget = data.riskBudget;
  if (!budget) return fallbackPct;
  if (budget.blockReasons.length > 0 && budget.recommendedRiskPct <= 0) {
    return 0;
  }
  return Math.min(fallbackPct, budget.recommendedRiskPct);
}

export function applyRiskBudgetToAnalyzeResponse(
  response: AnalyzeApiResponse,
  budget: RiskBudgetResult,
): AnalyzeApiResponse {
  const capped = Math.min(
    response.step6_actionPlan.suggestedSizePct,
    budget.recommendedRiskPct,
  );

  const next: AnalyzeApiResponse = {
    ...response,
    riskBudget: budget,
    step6_actionPlan: {
      ...response.step6_actionPlan,
      suggestedSizePct: capped,
    },
  };

  if (next.tradingDesk) {
    const reasons = [...next.tradingDesk.committee.topReasons];
    if (budget.sizeReductionReasons.length > 0) {
      reasons.unshift(
        `Risk budget: ${budget.recommendedRiskPct}% (max ${budget.maxAllowedRiskPct}%) — ${budget.sizeReductionReasons[0]}`,
      );
    }
    if (budget.blockReasons.length > 0) {
      reasons.unshift(`Risk budget block: ${budget.blockReasons[0]}`);
    }
    next.tradingDesk = {
      ...next.tradingDesk,
      riskBudget: budget,
      committee: {
        ...next.tradingDesk.committee,
        topReasons: [...new Set(reasons)].slice(0, 5),
        finalActionPlan:
          budget.blockReasons.length > 0
            ? `${next.tradingDesk.committee.finalActionPlan} · Risk budget: no new size allocated.`
            : `${next.tradingDesk.committee.finalActionPlan} · Suggested size ${budget.recommendedRiskPct}% ($${budget.recommendedPositionSizeUsd}).`,
      },
    };
  }

  return next;
}

export function capOrderTicketWithRiskBudget(
  ticket: OrderTicket,
  budget: RiskBudgetResult | null | undefined,
): OrderTicket {
  if (!budget) return ticket;
  const capped = Math.min(ticket.positionSizePct, budget.recommendedRiskPct);
  return {
    ...ticket,
    positionSizePct: capped,
    maxRiskPct: Math.min(ticket.maxRiskPct, budget.recommendedRiskPct),
  };
}

export function riskBudgetBlocksNewTrade(
  budget: RiskBudgetResult | null | undefined,
): boolean {
  if (!budget) return false;
  return budget.blockReasons.length > 0 || budget.recommendedRiskPct <= 0;
}
