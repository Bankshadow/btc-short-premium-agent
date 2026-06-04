import type { AgentRecommendation, ConfidenceLevel } from "@/lib/agents/types";

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

export function confidenceBadgeClass(level: ConfidenceLevel): string {
  switch (level) {
    case "HIGH":
      return "bg-zinc-800 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900";
    case "MEDIUM":
      return "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200";
    case "LOW":
      return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
  }
}
