import type { AnalyzeApiResponse, DecisionEngineInput } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";
import { buildRiskBudgetInput } from "./build-optimizer-input";
import { optimizeRiskBudget } from "./optimize-risk-budget";
import { applyRiskBudgetToAnalyzeResponse } from "./apply-risk-budget";

export function applyRiskBudgetLayerToAnalyzeResponse(
  response: AnalyzeApiResponse,
  input?: {
    entries?: DecisionLogEntry[];
    orders?: PaperOrder[];
    perpPositions?: PerpPaperPosition[];
    riskProfile?: DecisionEngineInput["deskRiskProfile"];
    governance?: GovernanceAnalyzePayload | null;
  },
): AnalyzeApiResponse {
  if (!input?.entries?.length && !input?.orders?.length) {
    return response;
  }

  const budgetInput = buildRiskBudgetInput({
    entries: input.entries ?? [],
    orders: input.orders ?? [],
    perpPositions: input.perpPositions,
    riskProfile: input.riskProfile ?? "balanced",
    analyze: response,
    governance: input.governance,
  });

  const budget = optimizeRiskBudget(budgetInput);
  return applyRiskBudgetToAnalyzeResponse(response, budget);
}
