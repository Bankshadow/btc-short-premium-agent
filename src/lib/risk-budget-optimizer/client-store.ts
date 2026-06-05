import type { RiskBudgetResult } from "./types";

const RISK_BUDGET_KEY = "btc-desk:risk-budget-latest";

export function saveClientRiskBudget(budget: RiskBudgetResult): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RISK_BUDGET_KEY, JSON.stringify(budget));
}

export function loadClientRiskBudget(): RiskBudgetResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RISK_BUDGET_KEY);
    return raw ? (JSON.parse(raw) as RiskBudgetResult) : null;
  } catch {
    return null;
  }
}
