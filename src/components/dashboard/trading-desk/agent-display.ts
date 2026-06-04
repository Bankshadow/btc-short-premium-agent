import type { AgentRecommendation, AgentStrategyType } from "@/lib/types/agent";

export function recBadgeClass(rec: AgentRecommendation): string {
  switch (rec) {
    case "TRADE":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "SKIP":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "WAIT":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
  }
}

export function strategyLabel(type: AgentStrategyType): string {
  const labels: Record<AgentStrategyType, string> = {
    market_data: "Market Data",
    spot: "Spot",
    futures: "Futures",
    options: "Options",
    risk: "Risk",
    committee: "Committee",
    portfolio: "Portfolio",
  };
  return labels[type];
}
