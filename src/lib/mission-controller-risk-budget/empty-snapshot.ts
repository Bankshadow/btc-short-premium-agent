import { emptyIntegratedRiskBudget } from "@/lib/integrated-risk-budget/empty-snapshot";
import { buildMissionControllerRiskBudget } from "./build-mission-controller-risk-budget";
import type { MissionControllerRiskBudgetSnapshot } from "./types";

export function emptyMissionControllerRiskBudget(): MissionControllerRiskBudgetSnapshot {
  return buildMissionControllerRiskBudget({
    integratedRiskBudget: emptyIntegratedRiskBudget(),
  });
}
