import type { SuggestedUse } from "@/lib/quant-strategy-importer/types";
import type { GarageBacktestSummary, StrategyGarageRiskClass } from "./types";

export function classifyStrategyRisk(input: {
  suggestedUse: SuggestedUse;
  riskNotes: string[];
  riskWarning: string;
  lastBacktest?: GarageBacktestSummary | null;
}): StrategyGarageRiskClass {
  let score = 0;
  if (input.suggestedUse === "ENTRY") score += 2;
  if (input.suggestedUse === "EXIT") score += 1;
  if (input.suggestedUse === "FILTER" || input.suggestedUse === "RISK_GATE") score += 0;
  if (input.suggestedUse === "RESEARCH_ONLY") score += 1;

  const noteText = [...input.riskNotes, input.riskWarning].join(" ").toLowerCase();
  if (noteText.includes("whipsaw") || noteText.includes("overfit")) score += 2;
  if (noteText.includes("trending") || noteText.includes("lagging")) score += 1;
  if (noteText.includes("autopilot")) score += 2;

  if (input.lastBacktest) {
    if (input.lastBacktest.maxDrawdownPct >= 20) score += 2;
    else if (input.lastBacktest.maxDrawdownPct >= 12) score += 1;
    if (input.lastBacktest.aiVerdict === "REJECT") score += 3;
    if (input.lastBacktest.aiVerdict === "BACKTEST_MORE") score += 1;
    if (input.lastBacktest.tradeCount < 8) score += 1;
  }

  if (score >= 6) return "EXTREME";
  if (score >= 4) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
}
