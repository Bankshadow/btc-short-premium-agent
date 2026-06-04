import type { AgentRecommendation, AgentStrategyType } from "@/lib/agents/types";

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
    SPOT: "Spot",
    FUTURES: "Futures",
    OPTIONS: "Options",
    RISK: "Risk",
    PORTFOLIO: "Portfolio",
    MARKET_DATA: "Market Data",
    REGIME: "Regime",
    COMMITTEE: "Committee",
  };
  return labels[type];
}

export function deskHealthClass(
  health: "ready" | "degraded" | "blocked",
): string {
  switch (health) {
    case "ready":
      return "text-emerald-600 dark:text-emerald-400";
    case "degraded":
      return "text-amber-600 dark:text-amber-400";
    case "blocked":
      return "text-red-600 dark:text-red-400";
  }
}
